import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";

const artifactPath = (...parts: string[]) =>
  path.join(
    process.cwd(),
    "docs",
    "tasks",
    "08282026-task009d-release-demo",
    "artifacts",
    ...parts,
  );

async function placeCursor(page: Page, editor: Locator, offset: number): Promise<void> {
  await selectRange(page, editor, offset, offset);
}

async function selectRange(
  _page: Page,
  editor: Locator,
  start: number,
  end: number,
): Promise<void> {
  await editor.evaluate((element, offsets) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const points: Array<{ node: Node; start: number; end: number }> = [];
    let cursor = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const length = node.textContent?.length ?? 0;
      points.push({ node, start: cursor, end: cursor + length });
      cursor += length;
    }
    const locate = (offset: number) => {
      const point = points.find((candidate) => offset >= candidate.start && offset <= candidate.end);
      if (!point) throw new Error(`Unable to locate editor offset ${offset}.`);
      return { node: point.node, offset: offset - point.start };
    };
    const from = locate(offsets.start);
    const to = locate(offsets.end);
    const range = document.createRange();
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    (element as HTMLElement).focus();
    document.dispatchEvent(new Event("selectionchange"));
  }, { start, end });
}

async function semanticJson(page: Page): Promise<string> {
  return (await page.getByTestId("semantic-corrections").textContent()) ?? "";
}

async function clearSuggestions(page: Page): Promise<void> {
  const more = page.locator(".suggest-more-actions");
  if (!(await more.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await more.locator("summary").click();
  }
  await more.getByRole("button", { name: "Clear suggestions" }).click();
}

type BrowserRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function overlaps(first: BrowserRect, second: BrowserRect, gap = 0): boolean {
  return !(
    first.right + gap <= second.left ||
    second.right + gap <= first.left ||
    first.bottom + gap <= second.top ||
    second.bottom + gap <= first.top
  );
}

async function layoutSnapshot(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return page.evaluate(() => {
    const proof = document.querySelector<HTMLElement>(".suggest-proof");
    if (!proof?.firstChild) throw new Error("Suggesting proof is unavailable.");
    const source = document.createRange();
    source.selectNodeContents(proof.firstChild);
    const sourceRects = [...source.getClientRects()].map((rect) => ({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    }));
    const annotations = [
      ...proof.querySelectorAll<SVGGElement>(
        "[data-correction-id][data-layout-candidate]",
      ),
    ].flatMap((group) => {
      const payloads = [
        ...group.querySelectorAll<SVGGraphicsElement>(
          '[data-proofmarks-role="inserted-text"], [data-proofmarks-role="replacement-text"], [data-proofmarks-role="notation-label"], [data-proofmarks-role="label"], [data-proofmarks-role="content-boundary"], [data-proofmarks-role="insertion-content-boundary"]',
        ),
      ];
      if (payloads.length === 0) return [];
      const rects = payloads.map((payload) => payload.getBoundingClientRect());
      return [
        {
          id: group.dataset.correctionId ?? "",
          lane: group.dataset.layoutLane ?? "",
          candidate: group.dataset.layoutCandidate ?? "",
          level: group.dataset.layoutLevel ?? "",
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
      annotations,
      sourceRects,
      overlays: proof.querySelectorAll("[data-proofmarks-overlay]").length,
      leaders: proof.querySelectorAll('[data-proofmarks-role="leader"]').length,
    };
  });
}

function expectReadableLayout(snapshot: Awaited<ReturnType<typeof layoutSnapshot>>) {
  expect(snapshot.overlays).toBe(1);
  for (const annotation of snapshot.annotations) {
    expect(
      snapshot.sourceRects.some((source) => overlaps(annotation.rect, source, 1)),
      `${annotation.id} payload overlaps source text`,
    ).toBe(false);
  }
  for (let index = 0; index < snapshot.annotations.length; index += 1) {
    for (let other = index + 1; other < snapshot.annotations.length; other += 1) {
      expect(
        overlaps(
          snapshot.annotations[index]!.rect,
          snapshot.annotations[other]!.rect,
          2,
        ),
        `${snapshot.annotations[index]!.id} overlaps ${snapshot.annotations[other]!.id}`,
      ).toBe(false);
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/suggest");
  await expect(
    page.getByRole("heading", { name: "Edit the text. Inspect the proof." }),
  ).toBeVisible();
  await clearSuggestions(page);
  await expect(page.locator("[data-suggestion-id]")).toHaveCount(0);
});

test("curated demos expose working copy, accepted proof, semantic data, visibility, and reset", async ({
  page,
}) => {
  await page.goto("/suggest");
  await expect(page.locator("[data-suggestion-id]")).toHaveCount(2);
  await expect(page.getByRole("textbox", { name: "Editable working draft" })).toHaveText(
    "The writer carefully reviewed the new manuscript.",
  );
  await expect(page.getByTestId("accepted-text")).toHaveText(
    "The editor carefully reviewed the manuscript.",
  );
  await expect(page.getByTestId("preset-semantic-corrections")).toContainText(
    '"type": "replace"',
  );

  await page.getByLabel("Example", { exact: true }).selectOption("delete-transpose");
  await expect(page.getByTestId("preset-semantic-corrections")).toContainText(
    '"type": "transpose"',
  );
  await expect(page.getByRole("textbox", { name: "Editable working draft" })).toHaveText(
    "The editor reviewed the manuscript final.",
  );

  await page.getByLabel("Example", { exact: true }).selectOption("spacing");
  await expect(page.getByRole("textbox", { name: "Editable working draft" })).toHaveText(
    "Set this phrase with uneven spacing.",
  );
  await expect(page.getByTestId("preset-semantic-corrections")).toContainText(
    '"kind": "text-point"',
  );
  await expect(page.getByTestId("preset-semantic-corrections")).toContainText(
    '"kind": "text-range"',
  );

  const proof = page.locator(".suggest-proof");
  const semanticBefore = await semanticJson(page);
  const acceptedBefore = await page.getByTestId("accepted-text").textContent();
  const draftBefore = await page.getByTestId("draft-text").textContent();
  await proof.locator("[data-proofmarks-overlay]").evaluate((overlay) => {
    (overlay as SVGSVGElement).dataset.visibilityTestIdentity = "same-overlay";
  });
  await page.getByRole("button", { name: "Hide proofmarks" }).click();
  await expect(proof.locator("[data-proofmarks-overlay]")).toHaveCSS("visibility", "hidden");
  await expect(proof.locator("[data-proofmarks-overlay]")).toHaveAttribute(
    "data-visibility-test-identity",
    "same-overlay",
  );
  expect(await semanticJson(page)).toBe(semanticBefore);
  expect(await page.getByTestId("accepted-text").textContent()).toBe(acceptedBefore);
  expect(await page.getByTestId("draft-text").textContent()).toBe(draftBefore);

  await page.getByRole("button", { name: "Show proofmarks" }).click();
  await expect(proof.locator("[data-proofmarks-overlay]")).toHaveCSS("visibility", "visible");
  await page.getByRole("button", { name: "Accept preset-open-boundary" }).click();
  await expect(page.locator("[data-suggestion-id]")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset example" }).click();
  await expect(page.locator("[data-suggestion-id]")).toHaveCount(2);
  await expect(page.getByTestId("accepted-text")).toHaveText(
    "Set thisphrase    with uneven spacing.",
  );
  await page.locator(".skip-link").evaluate((element) => {
    (element as HTMLElement).style.visibility = "hidden";
  });
  await page.screenshot({
    path: artifactPath("task009d-playground.png"),
    fullPage: true,
  });
});

test("notation and queue inspection change only the mark layer with useful feedback", async ({
  page,
}) => {
  await page.goto("/suggest");
  const proof = page.locator(".suggest-proof");
  const sourceBefore = await proof.evaluate((element) => element.firstChild?.textContent ?? "");
  const overlay = proof.locator("[data-proofmarks-overlay]");
  await overlay.evaluate((element) => {
    (element as SVGSVGElement).dataset.transitionIdentity = "same-layer";
  });

  await page.getByLabel("Notation", { exact: true }).selectOption("gb");
  await expect(page.getByRole("status")).toHaveText("Same correction data · rendered as GB.");
  await expect(overlay).toHaveAttribute("data-transition-identity", "same-layer");
  await expect(overlay).toHaveCSS("opacity", "1");
  expect(await proof.evaluate((element) => element.firstChild?.textContent ?? "")).toBe(sourceBefore);

  const inspect = page.locator(".suggest-inspect-target").first();
  const correctionId = await page.locator("[data-suggestion-id]").first().getAttribute("data-suggestion-id");
  await inspect.click();
  await expect(inspect).toHaveAttribute("aria-pressed", "true");
  await expect(proof).toHaveAttribute("data-inspection-active", "true");
  await expect(proof.locator(`[data-correction-id="${correctionId}"][data-inspected]`)).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => {
    const registry = (CSS as unknown as { highlights?: { has(name: string): boolean } }).highlights;
    return registry?.has("proofmarks-suggestion-target") ?? false;
  })).toBe(true);
});

test("an edit crossing an unresolved suggestion is rejected atomically", async ({ page }) => {
  await page.goto("/suggest");
  const editor = page.getByRole("textbox", { name: "Editable working draft" });
  const proof = page.locator(".suggest-proof");
  const before = {
    accepted: await page.getByTestId("accepted-text").textContent(),
    working: await page.getByTestId("draft-text").textContent(),
    corrections: await semanticJson(page),
    total: await page.getByTestId("proof-corrections-total").textContent(),
    active: await page.getByTestId("proof-active").textContent(),
    history: await page.getByTestId("proof-history").textContent(),
    source: await proof.evaluate((element) => element.firstChild?.textContent ?? ""),
    marks: await proof.locator("[data-correction-id]").evaluateAll((groups) =>
      groups.map((group) => ({
        id: (group as SVGGElement).dataset.correctionId,
        operation: (group as SVGGElement).dataset.operation,
        path: group.innerHTML,
      })),
    ),
  };

  await selectRange(page, editor, 2, 14);
  await page.keyboard.press("Backspace");
  await expect(page.getByRole("status")).toHaveText(
    "This edit crosses an unresolved suggestion. Accept or reject it first.",
  );

  expect(await page.getByTestId("accepted-text").textContent()).toBe(before.accepted);
  expect(await page.getByTestId("draft-text").textContent()).toBe(before.working);
  expect(await semanticJson(page)).toBe(before.corrections);
  expect(await page.getByTestId("proof-corrections-total").textContent()).toBe(before.total);
  expect(await page.getByTestId("proof-active").textContent()).toBe(before.active);
  expect(await page.getByTestId("proof-history").textContent()).toBe(before.history);
  expect(await proof.evaluate((element) => element.firstChild?.textContent ?? "")).toBe(before.source);
  expect(await proof.locator("[data-correction-id]").evaluateAll((groups) =>
    groups.map((group) => ({
      id: (group as SVGGElement).dataset.correctionId,
      operation: (group as SVGGElement).dataset.operation,
      path: group.innerHTML,
    })),
  )).toEqual(before.marks);
  await expect(proof.locator("[data-proofmarks-overlay]")).toHaveCount(1);
});

test("marker themes are keyboard-operable and preserve geometry across appearances", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Reset example" }).click();
  const proof = page.locator(".suggest-proof");
  const overlay = proof.locator("[data-proofmarks-overlay]");
  const geometry = () => overlay.locator("line, path").evaluateAll((marks) =>
    marks.map((mark) => ({
      tag: mark.tagName,
      x1: mark.getAttribute("x1"),
      y1: mark.getAttribute("y1"),
      x2: mark.getAttribute("x2"),
      y2: mark.getAttribute("y2"),
      d: mark.getAttribute("d"),
    })),
  );
  const styleDisclosure = page.getByText("Marker style", { exact: true });
  await styleDisclosure.focus();
  await page.keyboard.press("Enter");
  const inkChoice = page.getByLabel("Ink", { exact: true });

  for (const appearance of ["Editorial", "Technical"] as const) {
    await page.getByLabel("Appearance", { exact: true }).selectOption(appearance.toLowerCase());
    const before = await geometry();
    await inkChoice.focus();
    await page.keyboard.press("h");
    await expect(inkChoice).toHaveValue("high-contrast");
    await expect.poll(() => overlay.evaluate((element) =>
      (element as SVGSVGElement).style.getPropertyValue("--proofmarks-mark-ink"),
    )).toBe("#173b63");
    expect(await geometry()).toEqual(before);

    await inkChoice.selectOption("canonical");
    await expect(inkChoice).toHaveValue("canonical");
    expect(await geometry()).toEqual(before);
  }

  await inkChoice.selectOption("high-contrast");
  await page.getByRole("button", { name: "Hide proofmarks" }).click();
  await expect(overlay).toHaveCSS("visibility", "hidden");
  await page.getByRole("button", { name: "Show proofmarks" }).click();
  await expect(overlay).toHaveCSS("visibility", "visible");
  await page.getByLabel("Notation", { exact: true }).selectOption("jis");
  await expect(overlay.locator("[data-correction-id]").first()).toHaveAttribute("data-notation-id", /jis/);
  await expect(overlay).toHaveAttribute("data-proofmarks-visible", "true");
  await expect.poll(() => overlay.evaluate((element) =>
    (element as SVGSVGElement).style.getPropertyValue("--proofmarks-mark-stroke-scale"),
  )).toBe("1.15");
  await expect(proof.locator("[data-proofmarks-overlay]")).toHaveCount(1);

  const lineWeight = page.getByRole("slider", { name: "Line weight" });
  const beforeWeight = await geometry();
  const beforeCorrections = await semanticJson(page);
  const beforeSource = await proof.evaluate((element) => element.firstChild?.textContent);
  const ink = overlay.locator("path[data-proofmarks-role], line[data-proofmarks-role]").first();
  await lineWeight.focus();
  await page.keyboard.press("Home");
  await expect(lineWeight).toHaveValue("0.75");
  await expect.poll(() => overlay.evaluate((element) =>
    (element as SVGSVGElement).style.getPropertyValue("--proofmarks-mark-stroke-scale"),
  )).toBe("0.75");
  const renderedWidth = () => ink.evaluate((element) => parseFloat(element.getAttribute("stroke-width") ?? ""));
  await expect.poll(renderedWidth).toBeGreaterThan(0);
  const fineWidth = await renderedWidth();
  await page.keyboard.press("End");
  await expect(lineWeight).toHaveValue("1.5");
  await expect.poll(renderedWidth).toBeCloseTo(fineWidth * 2);
  expect(await geometry()).toEqual(beforeWeight);
  expect(await semanticJson(page)).toBe(beforeCorrections);
  expect(await proof.evaluate((element) => element.firstChild?.textContent)).toBe(beforeSource);
  await inkChoice.selectOption("canonical");
  await expect(lineWeight).toHaveValue("1.5");
  await expect(overlay.locator("[data-proofmarks-halo-for]").first()).toHaveCSS("stroke", "rgba(0, 0, 0, 0)");
});

test("normal typing becomes one stable insertion and notation switching is pure", async ({
  page,
}) => {
  const editor = page.getByRole("textbox", { name: "Editable working draft" });
  await placeCursor(page, editor, 4);
  await page.keyboard.type("senior ");

  await expect(page.locator("[data-suggestion-id]")).toHaveCount(1);
  await expect(page.locator("[data-suggestion-id]")).toHaveAttribute("data-suggestion-id", "suggestion-1");
  await expect(page.getByTestId("semantic-corrections")).toContainText('"type": "insert"');
  await expect(page.getByTestId("semantic-corrections")).toContainText('"offset": 4');
  await expect(page.getByTestId("semantic-corrections")).toContainText('"content": "senior "');
  await expect(page.locator('[data-operation="insert"]')).toHaveCount(1);
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);
  const before = await semanticJson(page);

  for (const notation of ["日本 · JIS", "中文 · GB", "臺灣 · CNS 3927", "한국 · KS", "English · US"]) {
    await page.getByLabel("Notation", { exact: true }).selectOption({ label: notation });
    await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);
    expect(await semanticJson(page)).toBe(before);
  }
});

test("selection typing creates one replace and Accept commits the base proof", async ({ page }) => {
  const editor = page.getByRole("textbox", { name: "Editable working draft" });
  await selectRange(page, editor, 4, 10);
  await page.keyboard.type("writer");

  await expect(page.locator("[data-suggestion-id]")).toHaveCount(1);
  await expect(page.getByTestId("semantic-corrections")).toContainText('"type": "replace"');
  await expect(page.getByTestId("semantic-corrections")).toContainText(
    '"replacement": "writer"',
  );
  await expect(page.getByTestId("accepted-text")).toHaveText(
    "The editor carefully reviewed the manuscript.",
  );

  await page.getByRole("button", { name: "Accept suggestion-1" }).click();
  await expect(page.locator("[data-suggestion-id]")).toHaveCount(0);
  await expect(page.getByTestId("accepted-text")).toHaveText(
    "The writer carefully reviewed the manuscript.",
  );
  await expect(page.getByTestId("semantic-corrections")).toHaveText("[]");
});

test("suggestion identity follows ownership and lexical boundaries, not transaction timing", async ({
  page,
}) => {
  const editor = page.getByRole("textbox", { name: "Editable working draft" });
  await selectRange(page, editor, 4, 10);
  await page.keyboard.type("wri");

  await expect(page.locator("[data-suggestion-id]")).toHaveCount(1);
  await expect(page.locator("[data-suggestion-id]")).toHaveAttribute("data-suggestion-id", "suggestion-1");
  await expect(page.getByTestId("semantic-corrections")).toContainText(
    '"replacement": "wri"',
  );

  // Opening the inspector creates a deliberate separate interaction and editor
  // transaction group; identity must not depend on elapsed time or one burst.
  await page.getByText("Inspect adapter state", { exact: true }).click();
  await placeCursor(page, editor, 7);
  await page.keyboard.type("ter");

  await expect(page.locator("[data-suggestion-id]")).toHaveCount(1);
  await expect(page.locator("[data-suggestion-id]")).toHaveAttribute("data-suggestion-id", "suggestion-1");
  await expect(page.getByTestId("semantic-corrections")).toContainText(
    '"replacement": "writer"',
  );

  await placeCursor(page, editor, 10);
  await page.keyboard.type(" new");

  await expect(page.locator("[data-suggestion-id]")).toHaveCount(2);
  expect(await page.locator("[data-suggestion-id]").evaluateAll((rows) => rows.map(row => row.getAttribute("data-suggestion-id")))).toEqual([
    "suggestion-1",
    "suggestion-2",
  ]);
  await expect(page.getByTestId("semantic-corrections")).toContainText(
    '"content": " new"',
  );
  await expect(page.getByTestId("suggestion-ownership")).toContainText(
    '"draftOwnedSpan"',
  );
  await expect(page.getByTestId("suggestion-ownership")).toContainText(
    '"id": "suggestion-1"',
  );

  const acceptedBefore = await page.getByTestId("accepted-text").textContent();
  const draftBefore = await page.getByTestId("draft-text").textContent();
  const semanticBefore = await semanticJson(page);
  const ownershipBefore = await page.getByTestId("suggestion-ownership").textContent();

  for (const notation of ["日本 · JIS", "中文 · GB", "臺灣 · CNS 3927", "한국 · KS", "English · US"]) {
    await page.getByLabel("Notation", { exact: true }).selectOption({ label: notation });
    expect(await page.getByTestId("accepted-text").textContent()).toBe(acceptedBefore);
    expect(await page.getByTestId("draft-text").textContent()).toBe(draftBefore);
    expect(await semanticJson(page)).toBe(semanticBefore);
    expect(await page.getByTestId("suggestion-ownership").textContent()).toBe(
      ownershipBefore,
    );
    await expect(page.locator("[data-suggestion-id]")).toHaveCount(2);
  }

  await page.getByRole("button", { name: "Reject suggestion-1" }).click();
  await expect(page.getByTestId("semantic-corrections")).toContainText(
    '"type": "cancel-correction"',
  );
  await expect(page.getByTestId("semantic-corrections")).toContainText(
    '"correctionId": "suggestion-1"',
  );
  const rejectedRelation = await semanticJson(page);
  for (const notation of ["日本 · JIS", "中文 · GB", "臺灣 · CNS 3927", "한국 · KS", "English · US"]) {
    await page.getByLabel("Notation", { exact: true }).selectOption({ label: notation });
    expect(await semanticJson(page)).toBe(rejectedRelation);
  }
});

test("Task 007 writer + new + s regression uses collision-aware stable lanes", async ({
  page,
}) => {
  const editor = page.getByRole("textbox", { name: "Editable working draft" });
  await selectRange(page, editor, 4, 10);
  await page.keyboard.type("writer");
  await placeCursor(page, editor, 10);
  await page.keyboard.type(" new");
  await placeCursor(page, editor, 49);
  await page.keyboard.type("s");

  await expect(page.locator("[data-suggestion-id]")).toHaveCount(3);
  const semanticBefore = await semanticJson(page);
  const wide = await layoutSnapshot(page);
  expect(wide.annotations).toHaveLength(3);
  expect(wide.leaders).toBeGreaterThanOrEqual(3);
  expect(wide.annotations.every(({ lane }) => lane.length > 0)).toBe(true);
  expectReadableLayout(wide);

  await page.setViewportSize({ width: 760, height: 900 });
  const narrow = await layoutSnapshot(page);
  expect(narrow.annotations).toHaveLength(3);
  expectReadableLayout(narrow);
  expect(await semanticJson(page)).toBe(semanticBefore);

  await page.setViewportSize({ width: 1280, height: 900 });
  const wideAgain = await layoutSnapshot(page);
  expectReadableLayout(wideAgain);
  expect(
    wideAgain.annotations.map(({ id, lane, candidate, route }) => ({
      id,
      lane,
      candidate,
      route,
    })),
  ).toEqual(
    wide.annotations.map(({ id, lane, candidate, route }) => ({
      id,
      lane,
      candidate,
      route,
    })),
  );
  expect(await semanticJson(page)).toBe(semanticBefore);
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);
});

test("delete and Reject preserve a real cancel-correction relation", async ({ page }) => {
  const editor = page.getByRole("textbox", { name: "Editable working draft" });
  await selectRange(page, editor, 11, 21);
  await page.keyboard.press("Backspace");

  await expect(page.getByTestId("semantic-corrections")).toContainText('"type": "delete"');
  await expect(page.getByTestId("proof-active")).toHaveText("1");
  await expect(page.getByTestId("proof-history")).toHaveText("0");
  await expect(page.locator('[data-operation="delete"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Reject suggestion-1" }).click();

  await expect(page.locator("[data-suggestion-id]")).toHaveCount(0);
  await expect(page.getByTestId("semantic-corrections")).toContainText(
    '"type": "cancel-correction"',
  );
  await expect(page.getByTestId("semantic-corrections")).toContainText(
    '"correctionId": "suggestion-1"',
  );
  await expect(page.getByTestId("draft-text")).toHaveText(
    "The editor carefully reviewed the manuscript.",
  );
  await expect(page.getByTestId("proof-corrections-total")).toHaveText("2");
  await expect(page.getByTestId("proof-active")).toHaveText("0");
  await expect(page.getByTestId("proof-history")).toHaveText("2");
  await expect(page.locator('[data-operation="cancel-correction"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="notation-label"]')).toContainText("stet");
});

test("paste is one insertion and explicit selection authors transpose", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const editor = page.getByRole("textbox", { name: "Editable working draft" });
  await placeCursor(page, editor, 4);
  await page.evaluate(() => navigator.clipboard.writeText("senior "));
  await page.keyboard.press("ControlOrMeta+V");
  await expect(page.locator("[data-suggestion-id]")).toHaveCount(1);
  await expect(page.getByTestId("semantic-corrections")).toContainText('"content": "senior "');

  await clearSuggestions(page);
  await selectRange(page, editor, 11, 29);
  await page.getByRole("button", { name: "Transpose selection" }).click();
  await expect(page.getByTestId("semantic-corrections")).toContainText('"type": "transpose"');
  await expect(page.getByTestId("draft-text")).toContainText("reviewed carefully");
});

test("narrow layout keeps the editor, proof, and review actions in the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Editable working draft" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Accepted proof", exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});
