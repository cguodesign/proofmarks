import { expect, test, type Page } from "@playwright/test";

type Rect = { left: number; right: number; top: number; bottom: number };

function overlaps(first: Rect, second: Rect, gap = 0): boolean {
  return !(
    first.right + gap <= second.left ||
    second.right + gap <= first.left ||
    first.bottom + gap <= second.top ||
    second.bottom + gap <= first.top
  );
}

async function waitForLayout(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function inspectLayout(page: Page) {
  await waitForLayout(page);
  return page.evaluate(() => {
    const proof = document.querySelector<HTMLElement>("[data-testid='layout-proof-sheet']");
    if (!proof?.firstChild) throw new Error("Layout proof is unavailable.");
    const range = document.createRange();
    range.selectNodeContents(proof.firstChild);
    const sourceRects = [...range.getClientRects()].map((rect) => ({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    }));
    const groups = [
      ...proof.querySelectorAll<SVGGElement>("[data-correction-id]"),
    ];
    const payloads = groups.flatMap((group) => {
      const nodes = [
        ...group.querySelectorAll<SVGGraphicsElement>(
          '[data-proofmarks-role="inserted-text"], [data-proofmarks-role="replacement-text"], [data-proofmarks-role="notation-label"], [data-proofmarks-role="label"], [data-proofmarks-role="content-boundary"], [data-proofmarks-role="insertion-content-boundary"]',
        ),
      ];
      if (nodes.length === 0) return [];
      const rects = nodes.map((node) => node.getBoundingClientRect());
      return [
        {
          id: group.dataset.correctionId ?? "",
          lane: group.dataset.layoutLane ?? "",
          level: Number(group.dataset.layoutLevel ?? -1),
          candidate: group.dataset.layoutCandidate ?? "",
          score: Number(group.dataset.layoutScore ?? -1),
          route: group.dataset.leaderRoute ?? "",
          rect: {
            left: Math.min(...rects.map((rect) => rect.left)),
            right: Math.max(...rects.map((rect) => rect.right)),
            top: Math.min(...rects.map((rect) => rect.top)),
            bottom: Math.max(...rects.map((rect) => rect.bottom)),
          },
        },
      ];
    });
    return {
      groups: groups.length,
      payloads,
      sourceRects,
      overlays: proof.querySelectorAll("[data-proofmarks-overlay]").length,
      writingMode: proof.querySelector("[data-proofmarks-overlay]")?.getAttribute(
        "data-writing-mode",
      ),
    };
  });
}

function collisionCount(items: Array<{ rect: Rect }>, gap = 1): number {
  let count = 0;
  for (let index = 0; index < items.length; index += 1) {
    for (let other = index + 1; other < items.length; other += 1) {
      if (overlaps(items[index]!.rect, items[other]!.rect, gap)) count += 1;
    }
  }
  return count;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/layout");
  await expect(
    page.getByRole("heading", { name: /Give every mark.*room to speak/ }),
  ).toBeVisible();
});

test("008A regression composes nearby payloads without covering source text", async ({
  page,
}) => {
  const snapshot = await inspectLayout(page);

  expect(snapshot.overlays).toBe(1);
  expect(snapshot.groups).toBe(3);
  expect(snapshot.payloads).toHaveLength(3);
  expect(snapshot.payloads.every(({ lane, candidate }) => lane && candidate)).toBe(true);
  expect(collisionCount(snapshot.payloads, 2)).toBe(0);
  for (const payload of snapshot.payloads) {
    expect(
      snapshot.sourceRects.some((source) => overlaps(payload.rect, source, 1)),
      `${payload.id} covers source text`,
    ).toBe(false);
  }
});

test("dense proof escalates across lanes instead of catastrophic overlap", async ({ page }) => {
  await page.getByRole("button", { name: "Dense · 12" }).click();
  const snapshot = await inspectLayout(page);

  expect(snapshot.groups).toBe(12);
  expect(snapshot.overlays).toBe(1);
  expect(snapshot.payloads.length).toBeGreaterThanOrEqual(7);
  expect(new Set(snapshot.payloads.map(({ lane }) => lane)).size).toBeGreaterThanOrEqual(3);
  expect(new Set(snapshot.payloads.map(({ level }) => level)).size).toBeGreaterThanOrEqual(2);
  expect(collisionCount(snapshot.payloads)).toBeLessThanOrEqual(2);
  await expect(
    page.locator('[data-correction-id="dense-cancel-editor"]'),
  ).toHaveAttribute("data-layout-candidate", /.+/);
});

test("layout debug exposes bounds, lanes, candidates, collisions, and scores", async ({
  page,
}) => {
  await page.getByLabel("Layout debug").check();
  await waitForLayout(page);

  await expect(page.locator("[data-proofmarks-layout-debug]")).toHaveCount(1);
  await expect(page.locator('[data-layout-role="paper-bounds"]')).toHaveCount(1);
  await expect(page.locator('[data-layout-role="text-bounds"]')).toHaveCount(1);
  await expect(page.locator('[data-layout-role="lane"]')).toHaveCount(6);
  expect(await page.locator('[data-layout-role="candidate"]').count()).toBeGreaterThan(20);
  await expect(page.locator('[data-layout-role="chosen-candidate"]')).toHaveCount(3);
  const candidate = page.locator('[data-layout-role="candidate"]').first();
  await expect(candidate).toHaveAttribute("data-score", /\d/);
  await expect(candidate).toHaveAttribute("data-lane", /.+/);
  await expect(candidate).toHaveAttribute("data-collisions", /.*/);
});

test("vertical-rl maps logical block-start lanes to the physical right side", async ({
  page,
}) => {
  await page.getByRole("button", { name: "JIS", exact: true }).click();
  await page.getByRole("button", { name: "Vertical · rl" }).click();
  const snapshot = await inspectLayout(page);

  expect(snapshot.writingMode).toBe("vertical-rl");
  expect(snapshot.groups).toBe(3);
  expect(snapshot.overlays).toBe(1);
  const startLane = snapshot.payloads.find(({ lane }) => lane.startsWith("block-start"));
  expect(startLane).toBeDefined();
  const sourceRight = Math.max(...snapshot.sourceRects.map(({ right }) => right));
  expect(startLane!.rect.left).toBeGreaterThanOrEqual(sourceRight - 2);
  expect(collisionCount(snapshot.payloads, 1)).toBe(0);
});

test("paper resize recomputes layout without semantic mutation or overlay leaks", async ({
  page,
}) => {
  const semantic = await page.getByTestId("layout-corrections").textContent();
  const first = await inspectLayout(page);
  await page.getByLabel("Paper width").fill("400");
  const narrow = await inspectLayout(page);
  await page.getByLabel("Paper width").fill("640");
  const restored = await inspectLayout(page);

  expect(narrow.overlays).toBe(1);
  expect(restored.overlays).toBe(1);
  expect(await page.getByTestId("layout-corrections").textContent()).toBe(semantic);
  expect(
    restored.payloads.map(({ id, lane, candidate, route }) => ({
      id,
      lane,
      candidate,
      route,
    })),
  ).toEqual(
    first.payloads.map(({ id, lane, candidate, route }) => ({
      id,
      lane,
      candidate,
      route,
    })),
  );
});

test("008B appearance changes stroke treatment without changing semantic layout", async ({
  page,
}) => {
  const semantic = await page.getByTestId("layout-corrections").textContent();
  const technical = await inspectLayout(page);
  const technicalRoles = await page
    .locator("[data-proofmarks-role]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-proofmarks-role")));

  await page.getByRole("button", { name: "Editorial", exact: true }).click();
  const editorial = await inspectLayout(page);
  const editorialRoles = await page
    .locator("[data-proofmarks-role]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-proofmarks-role")));

  await expect(page.locator("[data-proofmarks-overlay]")).toHaveAttribute(
    "data-proofmarks-appearance",
    "editorial",
  );
  expect(await page.getByTestId("layout-corrections").textContent()).toBe(semantic);
  expect(
    editorial.payloads.map(({ id, lane, candidate, route }) => ({
      id,
      lane,
      candidate,
      route,
    })),
  ).toEqual(
    technical.payloads.map(({ id, lane, candidate, route }) => ({
      id,
      lane,
      candidate,
      route,
    })),
  );
  expect(editorialRoles).toEqual(technicalRoles);
  expect(await page.locator("[data-proofmarks-second-pass]").count()).toBeGreaterThan(0);
  await expect(
    page.locator('[data-proofmarks-role="replacement-text"]').first(),
  ).toHaveAttribute("transform", /rotate/);
});

test("editorial handwriting is deterministic and reduced motion suppresses animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Editorial", exact: true }).click();
  await waitForLayout(page);
  const first = await page.locator("[data-proofmarks-role]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      role: node.getAttribute("data-proofmarks-role"),
      d: node.getAttribute("d"),
      x1: node.getAttribute("x1"),
      y1: node.getAttribute("y1"),
      x2: node.getAttribute("x2"),
      y2: node.getAttribute("y2"),
      transform: node.getAttribute("transform"),
    })),
  );
  expect(
    await page
      .locator(".proofmarks-write-on")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");

  await page.getByRole("button", { name: "Technical", exact: true }).click();
  await page.getByRole("button", { name: "Editorial", exact: true }).click();
  await waitForLayout(page);
  const second = await page.locator("[data-proofmarks-role]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      role: node.getAttribute("data-proofmarks-role"),
      d: node.getAttribute("d"),
      x1: node.getAttribute("x1"),
      y1: node.getAttribute("y1"),
      x2: node.getAttribute("x2"),
      y2: node.getAttribute("y2"),
      transform: node.getAttribute("transform"),
    })),
  );
  expect(second).toEqual(first);
});

test("editorial treatment preserves five distinct notation grammars", async ({ page }) => {
  await page.getByRole("button", { name: "Editorial", exact: true }).click();
  const semantic = await page.getByTestId("layout-corrections").textContent();
  const signatures: string[] = [];

  for (const notation of ["JIS", "GB", "CNS 3927", "KS", "en-US"]) {
    await page.getByRole("button", { name: notation, exact: true }).click();
    await waitForLayout(page);
    signatures.push(
      JSON.stringify(
        await page.locator("[data-proofmarks-role]").evaluateAll((nodes) =>
          nodes.map((node) => ({
            role: node.getAttribute("data-proofmarks-role"),
            tag: node.tagName,
          })),
        ),
      ),
    );
    await expect(page.locator("[data-proofmarks-overlay]")).toHaveAttribute(
      "data-proofmarks-appearance",
      "editorial",
    );
    expect(await page.getByTestId("layout-corrections").textContent()).toBe(semantic);
  }

  expect(new Set(signatures).size).toBe(4);
});

test("wrapped multi-rect fallback keeps one payload connected to the aggregate target", async ({
  page,
}) => {
  await page.goto("/workbench");
  await page.getByLabel("Fixture").selectOption("wrapped");
  await waitForLayout(page);
  const overlay = page.locator("[data-proofmarks-overlay]");
  expect(Number(await overlay.getAttribute("data-client-rect-count"))).toBeGreaterThan(1);
  await expect(page.locator("[data-correction-id][data-layout-candidate]")).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="leader"]')).toHaveCount(1);
  await page.getByLabel("Vertical").check();
  // Force multiple columns independently of the platform's CJK font metrics.
  await page.locator("#proof-document").evaluate((element) => {
    element.style.inlineSize = "8em";
    element.style.minInlineSize = "0";
  });
  await waitForLayout(page);
  const verticalLayout = await page.locator("#proof-document").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      writingMode: style.writingMode,
      inlineSize: style.inlineSize,
      minInlineSize: style.minInlineSize,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      whiteSpace: style.whiteSpace,
      wordBreak: style.wordBreak,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      text: element.firstChild?.textContent,
    };
  });
  expect(
    Number(await overlay.getAttribute("data-client-rect-count")),
    JSON.stringify(verticalLayout),
  ).toBeGreaterThan(1);
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);
});

test("performance profiles expose bounded stage timings for 1, 10, and 30 corrections", async ({
  page,
}) => {
  for (const count of [1, 10, 30]) {
    await page.getByRole("button", { name: `Profile · ${count}`, exact: true }).click();
    await waitForLayout(page);
    const metrics = await page.locator("[data-proofmarks-overlay]").evaluate((overlay) => ({
      measurement: Number((overlay as SVGSVGElement).dataset.proofmarksMeasurementMs),
      sceneBuild: Number((overlay as SVGSVGElement).dataset.proofmarksSceneBuildMs),
      layout: Number((overlay as SVGSVGElement).dataset.proofmarksLayoutMs),
      sceneRender: Number((overlay as SVGSVGElement).dataset.proofmarksSceneRenderMs),
      candidates: Number((overlay as SVGSVGElement).dataset.proofmarksCandidateCount),
    }));

    expect(metrics.candidates).toBeGreaterThanOrEqual(count * 30);
    expect(metrics.measurement).toBeGreaterThanOrEqual(0);
    expect(metrics.sceneBuild).toBeGreaterThanOrEqual(0);
    expect(metrics.layout).toBeLessThan(150);
    expect(metrics.sceneRender).toBeLessThan(150);
    expect(
      metrics.measurement + metrics.sceneBuild + metrics.layout + metrics.sceneRender,
    ).toBeLessThan(300);
  }
});

test("100-correction stress remains finite and bounded", async ({ page }) => {
  await page.getByRole("button", { name: "Profile · 100", exact: true }).click();
  await waitForLayout(page);
  const result = await page.locator("[data-proofmarks-overlay]").evaluate((overlay) => ({
    html: overlay.outerHTML,
    overlays: overlay.parentElement?.querySelectorAll("[data-proofmarks-overlay]").length,
    corrections: overlay.querySelectorAll("[data-correction-id]").length,
    total:
      Number((overlay as SVGSVGElement).dataset.proofmarksMeasurementMs) +
      Number((overlay as SVGSVGElement).dataset.proofmarksSceneBuildMs) +
      Number((overlay as SVGSVGElement).dataset.proofmarksLayoutMs) +
      Number((overlay as SVGSVGElement).dataset.proofmarksSceneRenderMs),
  }));
  expect(result.overlays).toBe(1);
  expect(result.corrections).toBe(100);
  expect(result.html).not.toMatch(/NaN|Infinity/);
  expect(result.total).toBeLessThan(2_000);
});

test("100 wide/narrow resize cycles settle to one stable overlay", async ({ page }) => {
  const semantic = await page.getByTestId("layout-corrections").textContent();
  await page.getByLabel("Paper width").evaluate(async (input) => {
    const control = input as HTMLInputElement;
    for (let cycle = 0; cycle < 100; cycle += 1) {
      control.value = cycle % 2 === 0 ? "360" : "720";
      control.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  });
  await waitForLayout(page);
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);
  expect(await page.getByTestId("layout-corrections").textContent()).toBe(semantic);
  expect(
    await page.locator("[data-proofmarks-overlay]").evaluate((overlay) =>
      !/NaN|Infinity/.test(overlay.outerHTML),
    ),
  ).toBe(true);
});
