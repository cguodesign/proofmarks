import { expect, test, type Page } from "@playwright/test";

async function waitForRender(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function selectFixture(page: Page, fixture: string): Promise<void> {
  await page.getByLabel("Fixture").selectOption(fixture);
  await waitForRender(page);
}

async function getTargetRects(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector<HTMLElement>("#proof-document");
    const text = container?.firstChild;
    if (!container || !text) throw new Error("Proof fixture is unavailable.");
    const range = document.createRange();
    range.setStart(text, Number(container.dataset.targetStart));
    range.setEnd(text, Number(container.dataset.targetEnd));
    return Array.from(range.getClientRects()).map((rect) => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    }));
  });
}

async function getMarkGeometry(page: Page, role: string) {
  return page.locator(`[data-proofmarks-role="${role}"]`).evaluateAll((nodes) =>
    nodes.map((node) => ({
      tag: node.tagName,
      x1: node.getAttribute("x1"),
      y1: node.getAttribute("y1"),
      x2: node.getAttribute("x2"),
      y2: node.getAttribute("y2"),
      d: node.getAttribute("d"),
    })),
  );
}

async function assertTargetStrokesAreAttached(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const container = document.querySelector<HTMLElement>("#proof-document");
    const overlay = container?.querySelector<SVGSVGElement>("[data-proofmarks-overlay]");
    const text = container?.firstChild;
    const lines = Array.from(
      container?.querySelectorAll<SVGLineElement>('[data-proofmarks-role="target-stroke"]') ?? [],
    );
    if (!container || !overlay || !text || lines.length === 0) {
      return { attached: false, rectCount: 0, lineCount: lines.length };
    }
    const range = document.createRange();
    range.setStart(text, Number(container.dataset.targetStart));
    range.setEnd(text, Number(container.dataset.targetEnd));
    const targetRects = Array.from(range.getClientRects());
    const overlayRect = overlay.getBoundingClientRect();
    const attached = lines.every((line, index) => {
      const targetRect = targetRects[index];
      if (!targetRect) return false;
      const endpoints = [
        {
          x: overlayRect.left + Number(line.getAttribute("x1")),
          y: overlayRect.top + Number(line.getAttribute("y1")),
        },
        {
          x: overlayRect.left + Number(line.getAttribute("x2")),
          y: overlayRect.top + Number(line.getAttribute("y2")),
        },
      ];
      return endpoints.every(
        (point) =>
          point.x >= targetRect.left - 2 &&
          point.x <= targetRect.right + 2 &&
          point.y >= targetRect.top - 2 &&
          point.y <= targetRect.bottom + 2,
      );
    });
    return { attached, rectCount: targetRects.length, lineCount: lines.length };
  });
  expect(result.attached).toBe(true);
  expect(result.lineCount).toBe(result.rectCount);
}

async function assertRangeConstructionInsideTarget(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const container = document.querySelector<HTMLElement>("#proof-document");
    const overlay = container?.querySelector<SVGSVGElement>("[data-proofmarks-overlay]");
    const text = container?.firstChild;
    if (!container || !overlay || !text) return { attached: false, roles: [] };
    const range = document.createRange();
    range.setStart(text, Number(container.dataset.targetStart));
    range.setEnd(text, Number(container.dataset.targetEnd));
    const target = range.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const roles = ["range-start-boundary", "range-connector", "range-end-boundary"];
    const attached = roles.every((role) => {
      const line = container.querySelector<SVGLineElement>(
        `[data-proofmarks-role="${role}"]`,
      );
      if (!line) return false;
      return [
        [Number(line.getAttribute("x1")), Number(line.getAttribute("y1"))],
        [Number(line.getAttribute("x2")), Number(line.getAttribute("y2"))],
      ].every(
        ([x, y]) =>
          overlayRect.left + x! >= target.left - 2 &&
          overlayRect.left + x! <= target.right + 2 &&
          overlayRect.top + y! >= target.top - 2 &&
          overlayRect.top + y! <= target.bottom + 2,
      );
    });
    return { attached, roles };
  });
  expect(result.attached).toBe(true);
  for (const role of result.roles) {
    await expect(page.locator(`[data-proofmarks-role="${role}"]`)).toHaveCount(1);
  }
}

async function getExchangeRelationship(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector<HTMLElement>("#proof-document");
    const overlay = container?.querySelector<SVGSVGElement>("[data-proofmarks-overlay]");
    const path = container?.querySelector<SVGPathElement>('[data-proofmarks-role="exchange-path"]');
    const text = container?.firstChild;
    const semantic = JSON.parse(
      document.querySelector("#semantic-json")?.textContent ?? "{}",
    ) as { targets: Array<{ start: number; end: number }> };
    if (!container || !overlay || !path || !text || semantic.targets.length !== 2) {
      throw new Error("Exchange fixture is incomplete.");
    }
    const rects = semantic.targets.map((target) => {
      const range = document.createRange();
      range.setStart(text, target.start);
      range.setEnd(text, target.end);
      return range.getBoundingClientRect();
    });
    const overlayRect = overlay.getBoundingClientRect();
    const bounds = path.getBBox();
    const union = {
      left: Math.min(...rects.map((rect) => rect.left)) - overlayRect.left,
      right: Math.max(...rects.map((rect) => rect.right)) - overlayRect.left,
      top: Math.min(...rects.map((rect) => rect.top)) - overlayRect.top,
      bottom: Math.max(...rects.map((rect) => rect.bottom)) - overlayRect.top,
    };
    return {
      bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      union: {
        ...union,
        width: union.right - union.left,
        height: union.bottom - union.top,
      },
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/workbench");
});

test("DX hero changes only props while correction JSON and overlay lifecycle stay stable", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/dx");
  await expect(
    page.getByRole("heading", { name: /Describe the edit.*Change the grammar/ }),
  ).toBeVisible();
  await expect(page.locator(".dx-proof")).toContainText("吾輩は猫である。名前はまだ無い。");
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-notation-id",
    "ja-jis-z8208-reference",
  );
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-fidelity",
    "reference-based",
  );
  await expect(page.locator('[data-proofmarks-role="notation-label"]')).toHaveText("トル");
  await expect(page.locator(".dx-json code")).toContainText('"kind": "text-range"');
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);
  const correctionJson = await page.locator(".dx-json code").textContent();

  await page.getByRole("button", { name: "GB", exact: true }).click();
  await waitForRender(page);
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-notation-id",
    "zh-gb-t14706-reference",
  );
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-fidelity",
    "reference-based",
  );
  await expect(page.locator('[data-proofmarks-role="target-boundary"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="notation-label"]')).toHaveCount(0);
  expect(await page.locator(".dx-json code").textContent()).toBe(correctionJson);
  await expect(page.locator(".dx-prop-line")).toContainText(
    "notation={gb}",
  );
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);

  await page.getByRole("button", { name: "Add correction" }).click();
  await waitForRender(page);
  await expect(page.locator(".dx-json code")).toContainText('"id": "c2"');
  await expect(page.locator('[data-operation="insert"]')).toHaveCount(1);
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);

  await page.getByRole("button", { name: "Remove correction" }).click();
  await waitForRender(page);
  await expect(page.locator('[data-operation="insert"]')).toHaveCount(0);
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);

  await page.getByRole("button", { name: /Change text width/ }).click();
  await expect(page.locator(".dx-proof")).toHaveAttribute("style", /width: 460px/);

  await page.getByRole("button", { name: "KS", exact: true }).click();
  await waitForRender(page);
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-notation-id",
    "ko-ks-a0104-reference",
  );
  await page.getByRole("button", { name: "en-US", exact: true }).click();
  await waitForRender(page);
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-notation-id",
    "en-us-traditional-reference",
  );

  await page.goto("/fixtures/marks");
  await page.goto("/dx");
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);
  expect(consoleErrors).toEqual([]);
});

test("single-character delete is attached in horizontal and vertical composition", async ({
  page,
}) => {
  await selectFixture(page, "delete-single");
  const semanticBefore = await page.locator("#semantic-json").textContent();
  await expect(page.locator('[data-proofmarks-role="notation-label"]')).toHaveText("トル");
  await assertTargetStrokesAreAttached(page);
  const horizontal = await getMarkGeometry(page, "target-stroke");

  await page.getByLabel("Vertical").check();
  await waitForRender(page);
  await assertTargetStrokesAreAttached(page);
  expect(await getMarkGeometry(page, "target-stroke")).not.toEqual(horizontal);
  expect(await page.locator("#semantic-json").textContent()).toBe(semanticBefore);
});

test("multi-character delete exposes boundaries and connector in both writing modes", async ({
  page,
}) => {
  await selectFixture(page, "delete-multi");
  await assertRangeConstructionInsideTarget(page);
  const horizontal = await getMarkGeometry(page, "range-connector");
  await page.getByLabel("Vertical").check();
  await waitForRender(page);
  await assertRangeConstructionInsideTarget(page);
  expect(await getMarkGeometry(page, "range-connector")).not.toEqual(horizontal);

  await page.getByLabel("Show geometry").check();
  await expect(page.locator('[data-debug-role="range-start"]')).toHaveCount(1);
  await expect(page.locator('[data-debug-role="range-end"]')).toHaveCount(1);
  await expect(page.locator('[data-debug-role="label-anchor"]')).toHaveCount(1);
});

test("insert encloses real content and changes construction by writing mode", async ({ page }) => {
  await selectFixture(page, "insert");
  const semanticBefore = await page.locator("#semantic-json").textContent();
  await expect(page.locator('[data-proofmarks-role="insertion-anchor"]')).toHaveCount(2);
  await expect(page.locator('[data-proofmarks-role="insertion-content-boundary"]')).toHaveCount(2);
  await expect(page.locator('[data-proofmarks-role="inserted-text"]')).toHaveText("再");
  const horizontalBoundaries = await getMarkGeometry(page, "insertion-content-boundary");
  expect(horizontalBoundaries.every((line) => line.y1 === line.y2)).toBe(true);

  await page.getByLabel("Vertical").check();
  await waitForRender(page);
  const verticalBoundaries = await getMarkGeometry(page, "insertion-content-boundary");
  expect(verticalBoundaries.every((line) => line.x1 === line.x2)).toBe(true);
  expect(verticalBoundaries).not.toEqual(horizontalBoundaries);
  await expect(page.locator('[data-proofmarks-role="inserted-text"]')).toHaveAttribute(
    "writing-mode",
    "vertical-rl",
  );
  expect(await page.locator("#semantic-json").textContent()).toBe(semanticBefore);
});

test("replacement shows target removal and replacement material horizontally and vertically", async ({
  page,
}) => {
  await selectFixture(page, "replace-multi");
  await assertRangeConstructionInsideTarget(page);
  await expect(page.locator('[data-proofmarks-role="replacement-text"]')).toHaveText("文章");
  await page.getByLabel("Vertical").check();
  await waitForRender(page);
  await assertRangeConstructionInsideTarget(page);
  await expect(page.locator('[data-proofmarks-role="replacement-text"]')).toHaveAttribute(
    "writing-mode",
    "vertical-rl",
  );
});

test("transpose path crosses character operands in both writing modes", async ({ page }) => {
  await selectFixture(page, "transpose");
  const horizontal = await getExchangeRelationship(page);
  expect(horizontal.bounds.width).toBeGreaterThan(horizontal.union.width * 0.85);

  await page.getByLabel("Vertical").check();
  await waitForRender(page);
  const vertical = await getExchangeRelationship(page);
  expect(vertical.bounds.height).toBeGreaterThan(vertical.union.height * 0.85);
  expect(vertical.bounds).not.toEqual(horizontal.bounds);

  await page.getByLabel("Show geometry").check();
  await expect(page.locator('[data-debug-role="operand-a"]')).toHaveCount(1);
  await expect(page.locator('[data-debug-role="operand-b"]')).toHaveCount(1);
});

test("transpose supports adjacent groups without falling back", async ({ page }) => {
  await selectFixture(page, "transpose-group");
  await expect(page.locator('[data-operation="transpose"]')).toHaveAttribute(
    "data-fidelity",
    "reference-based",
  );
  await expect(page.locator('[data-proofmarks-role="exchange-path"]')).toHaveCount(1);
  await page.getByLabel("Vertical").check();
  await waitForRender(page);
  await expect(page.locator('[data-operation="transpose"]')).toHaveAttribute(
    "data-fidelity",
    "reference-based",
  );
});

test("relation-aware イキ references the prior deletion without a new leader", async ({ page }) => {
  await selectFixture(page, "cancel-correction");
  const semanticBefore = await page.locator("#semantic-json").textContent();
  expect(semanticBefore).toContain('"correctionId": "delete-original"');
  expect(semanticBefore).not.toContain('"type": "retain"');
  await expect(page.locator('[data-operation="delete"]')).toHaveCount(1);
  await expect(page.locator('[data-operation="cancel-correction"]')).toHaveCount(1);
  await expect(
    page.locator('[data-operation="cancel-correction"] [data-proofmarks-role="leader"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-operation="cancel-correction"] [data-proofmarks-role="notation-label"]'),
  ).toHaveText("イキ");
  await page.getByLabel("Vertical").check();
  await waitForRender(page);
  await expect(
    page.locator('[data-operation="cancel-correction"] [data-proofmarks-role="notation-label"]'),
  ).toHaveAttribute("writing-mode", "vertical-rl");
  expect(await page.locator("#semantic-json").textContent()).toBe(semanticBefore);
});

test("five notation packs and technical switching preserve semantic JSON while changing scenes", async ({
  page,
}) => {
  await selectFixture(page, "replace-single");
  const semanticBefore = await page.locator("#semantic-json").textContent();
  const jisGeometry = await getMarkGeometry(page, "target-stroke");

  await page.getByLabel("Notation").selectOption("gb");
  await waitForRender(page);
  await expect(page.locator('[data-operation="replace"]')).toHaveAttribute(
    "data-notation-id",
    "zh-gb-t14706-reference",
  );
  await expect(page.locator('[data-proofmarks-role="target-boundary"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="content-boundary"]')).toHaveCount(1);
  expect(await getMarkGeometry(page, "target-boundary")).not.toEqual(jisGeometry);
  expect(await page.locator("#semantic-json").textContent()).toBe(semanticBefore);

  await page.getByLabel("Notation").selectOption("cns");
  await waitForRender(page);
  await expect(page.locator('[data-operation="replace"]')).toHaveAttribute(
    "data-notation-id",
    "cns3927",
  );
  await expect(page.locator('[data-proofmarks-role="target-boundary"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="content-boundary"]')).toHaveCount(1);
  expect(await page.locator("#semantic-json").textContent()).toBe(semanticBefore);

  await page.getByLabel("Notation").selectOption("ks");
  await waitForRender(page);
  await expect(page.locator('[data-operation="replace"]')).toHaveAttribute(
    "data-notation-id",
    "ko-ks-a0104-reference",
  );
  await expect(page.locator('[data-proofmarks-role="target-boundary"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="content-boundary"]')).toHaveCount(0);
  await expect(page.locator('[data-proofmarks-role="replacement-text"]')).toHaveText("章");
  expect(await page.locator("#semantic-json").textContent()).toBe(semanticBefore);

  await page.getByLabel("Notation").selectOption("en");
  await waitForRender(page);
  await expect(page.locator('[data-operation="replace"]')).toHaveAttribute(
    "data-notation-id",
    "en-us-traditional-reference",
  );
  await expect(page.locator('[data-proofmarks-role="target-stroke"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="deletion-tail"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="insertion-anchor"]')).toHaveCount(2);
  await expect(page.locator('[data-proofmarks-role="replacement-text"]')).toHaveText("章");
  expect(await page.locator("#semantic-json").textContent()).toBe(semanticBefore);

  await page.getByLabel("Notation").selectOption("technical");
  await waitForRender(page);
  await expect(page.locator('[data-operation="replace"]')).toHaveAttribute(
    "data-notation-id",
    "technical",
  );
  expect(await page.locator("#semantic-json").textContent()).toBe(semanticBefore);
});

test("GB delete uses its circle and curled tail horizontally, then falls back vertically", async ({
  page,
}) => {
  await page.getByLabel("Notation").selectOption("gb");
  await selectFixture(page, "delete-single");
  const semanticBefore = await page.locator("#semantic-json").textContent();
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-fidelity",
    "reference-based",
  );
  await expect(page.locator('[data-proofmarks-role="target-boundary"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="deletion-tail"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="notation-label"]')).toHaveCount(0);

  await page.getByLabel("Vertical").check();
  await waitForRender(page);
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-fidelity",
    "generic-fallback",
  );
  await expect(page.locator('[data-proofmarks-role="target-boundary"]')).toHaveCount(0);
  expect(await page.locator("#semantic-json").textContent()).toBe(semanticBefore);
});

test("GB insert and replace use circled material without JIS enclosure geometry", async ({
  page,
}) => {
  await page.getByLabel("Notation").selectOption("gb");
  await selectFixture(page, "insert");
  await expect(page.locator('[data-proofmarks-role="insertion-anchor"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="content-boundary"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="insertion-content-boundary"]')).toHaveCount(0);
  await expect(page.locator('[data-proofmarks-role="inserted-text"]')).toHaveText("再");

  await selectFixture(page, "replace-multi");
  await expect(page.locator('[data-proofmarks-role="target-boundary"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="content-boundary"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="replacement-text"]')).toHaveText("文章");
  await expect(page.locator('[data-proofmarks-role="range-connector"]')).toHaveCount(0);

  await page.getByLabel("Vertical").check();
  await waitForRender(page);
  await expect(page.locator('[data-operation="replace"]')).toHaveAttribute(
    "data-fidelity",
    "generic-fallback",
  );
});

test("GB transpose uses two hooks and GB 保留 marks the referenced deletion", async ({ page }) => {
  await page.getByLabel("Notation").selectOption("gb");
  await selectFixture(page, "transpose");
  await expect(page.locator('[data-proofmarks-role="exchange-path"]')).toHaveCount(2);
  await expect(page.locator('[data-operation="transpose"]')).toHaveAttribute(
    "data-fidelity",
    "reference-based",
  );

  await selectFixture(page, "cancel-correction");
  const semanticBefore = await page.locator("#semantic-json").textContent();
  await expect(page.locator('[data-operation="cancel-correction"]')).toHaveAttribute(
    "data-fidelity",
    "reference-based",
  );
  await expect(
    page.locator('[data-operation="cancel-correction"] [data-proofmarks-role="retention-mark"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-operation="cancel-correction"] [data-proofmarks-role="cancel-stroke"]'),
  ).toHaveCount(2);
  await expect(page.locator('[data-proofmarks-role="notation-label"]')).toHaveCount(0);

  const relationAttachment = await page.evaluate(() => {
    const tail = document.querySelector<SVGGraphicsElement>(
      '[data-operation="delete"] [data-proofmarks-role="deletion-tail"]',
    );
    const strokes = Array.from(
      document.querySelectorAll<SVGGraphicsElement>(
        '[data-operation="cancel-correction"] [data-proofmarks-role="cancel-stroke"]',
      ),
    );
    if (!tail || strokes.length !== 2) return false;
    const tailBounds = tail.getBBox();
    return strokes.every((stroke) => {
      const bounds = stroke.getBBox();
      return (
        bounds.x <= tailBounds.x + tailBounds.width + 8 &&
        bounds.x + bounds.width >= tailBounds.x - 8 &&
        bounds.y <= tailBounds.y + tailBounds.height + 8 &&
        bounds.y + bounds.height >= tailBounds.y - 8
      );
    });
  });
  expect(relationAttachment).toBe(true);

  await page.getByLabel("Show geometry").check();
  await expect(page.locator('[data-debug-role="referenced-target-rect"]')).toHaveCount(1);
  await expect(page.locator('[data-debug-role="referenced-scene-bounds"]')).toHaveCount(1);
  await expect(page.locator('[data-debug-role="cancel-anchor"]')).toHaveCount(1);

  await page.getByLabel("Document width").fill("420");
  await waitForRender(page);
  expect(await page.locator("#semantic-json").textContent()).toBe(semanticBefore);
});

test("expanded operations keep semantic JSON stable while notation and writing mode change", async ({ page }) => {
  await selectFixture(page, "move");
  const moveJson = await page.locator("#semantic-json").textContent();
  await expect(page.locator('[data-operation="move"]')).toHaveAttribute(
    "data-fidelity",
    "reference-based",
  );
  await expect(page.locator('[data-proofmarks-role="target-stroke"]')).toHaveCount(1);
  await expect(page.locator('[data-proofmarks-role="leader"]')).toHaveCount(1);

  await page.getByLabel("Notation").selectOption("gb");
  await waitForRender(page);
  await expect(page.locator('[data-operation="move"]')).toHaveAttribute(
    "data-notation-id",
    "zh-gb-t14706-reference",
  );
  expect(await page.locator("#semantic-json").textContent()).toBe(moveJson);

  await page.getByLabel("Vertical").check();
  await waitForRender(page);
  await expect(page.locator('[data-operation="move"]')).toHaveAttribute(
    "data-fidelity",
    "generic-fallback",
  );

  await page.getByLabel("Horizontal").check();
  await selectFixture(page, "increase-spacing");
  await expect(page.locator('[data-operation="increase-spacing"]')).toHaveAttribute(
    "data-fidelity",
    "reference-based",
  );
  await expect(page.locator('[data-proofmarks-role="notation-mark"]')).toHaveCount(4);

  await selectFixture(page, "decrease-spacing");
  await expect(page.locator('[data-operation="decrease-spacing"]')).toHaveAttribute(
    "data-fidelity",
    "reference-based",
  );
  await expect(page.locator('[data-proofmarks-role="notation-mark"]')).toHaveCount(1);
});

test("wrapped stress target reflows and escalates to explicit generic fallback", async ({ page }) => {
  await selectFixture(page, "wrapped");
  await page.getByLabel("Document width").fill("800");
  await waitForRender(page);
  expect(await getTargetRects(page)).toHaveLength(1);

  await page.getByLabel("Document width").fill("260");
  await waitForRender(page);
  const horizontalRects = await getTargetRects(page);
  expect(horizontalRects.length).toBeGreaterThanOrEqual(3);
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-fidelity",
    "generic-fallback",
  );
  await assertTargetStrokesAreAttached(page);

  const semanticBefore = await page.locator("#semantic-json").textContent();
  await page.getByLabel("Vertical").check();
  // Force multiple columns independently of the platform's CJK font metrics.
  await page.locator("#proof-document").evaluate((element) => {
    element.style.inlineSize = "8em";
    element.style.minInlineSize = "0";
  });
  await waitForRender(page);
  expect((await getTargetRects(page)).length).toBeGreaterThan(1);
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-fidelity",
    "generic-fallback",
  );
  expect(await page.locator("#semantic-json").textContent()).toBe(semanticBefore);
  await assertTargetStrokesAreAttached(page);
});

test("audited gallery exposes five packs and makes direct, unverified, fallback, and unsupported modes visible", async ({ page }) => {
  await page.goto("/fixtures/marks");
  await page.getByRole("button", { name: "Show all marks" }).click();
  await expect(page.locator("[data-marks-opening-proof] [data-proofmarks-overlay]")).toHaveCount(1);
  await expect(page.locator("[data-marks-opening-proof] [data-correction-id]")).toHaveCount(1);
  await expect(page.locator("[data-gallery-pack]")).toHaveCount(5);
  await expect(page.locator("[data-gallery-operation]")).toHaveCount(40);
  await expect(page.locator("[data-gallery-sheet]")).toHaveCount(112);
  await expect(
    page.locator('[data-gallery-pack="jis"] [data-operation][data-fidelity="reference-based"]'),
  ).toHaveCount(21);
  await expect(
    page.locator('[data-gallery-pack="gb"] [data-operation][data-fidelity="reference-based"]'),
  ).toHaveCount(12);
  await expect(
    page.locator('[data-gallery-pack="gb"] [data-operation][data-fidelity="generic-fallback"]'),
  ).toHaveCount(12);
  await expect(
    page.locator('[data-gallery-pack="cns"] [data-operation][data-fidelity="reference-based"]'),
  ).not.toHaveCount(0);
  await expect(
    page.locator('[data-gallery-pack="cns"] [data-operation][data-fidelity="generic-fallback"]'),
  ).not.toHaveCount(0);
  await expect(
    page.locator('[data-gallery-pack="ks"] [data-operation][data-fidelity="reference-based"]'),
  ).toHaveCount(11);
  await expect(
    page.locator('[data-gallery-pack="ks"] [data-operation][data-fidelity="generic-fallback"]'),
  ).toHaveCount(13);
  await expect(
    page.locator('[data-gallery-pack="en"] [data-operation][data-fidelity="reference-based"]'),
  ).toHaveCount(13);
  await expect(
    page.locator('[data-gallery-pack="en"] [data-operation][data-fidelity="unsupported"]'),
  ).toHaveCount(13);
  await expect(page.locator("[data-mixed-proof]")).toHaveCount(5);
  await expect(page.locator("[data-mixed-proof] [data-operation]")).toHaveCount(40);
  await expect(page.locator('.mixed-proof-section[data-fixture-kind="layout-stress"]')).toContainText(
    "not a canonical specimen or recommended proofreading density",
  );
  await expect(page.locator("[data-mixed-proof][lang='en']")).toHaveCount(5);
  await expect(page.locator("[data-spacing-audit]")).toHaveCount(10);
  await expect(page.locator("[data-spacing-audit] [data-proofmarks-overlay]")).toHaveCount(10);
  await expect(page.locator("[data-spacing-multi-stress] [data-proofmarks-overlay]")).toHaveCount(1);
  await expect(page.locator('[data-spacing-operation$="increase-spacing"] figcaption code')).toContainText([
    "text-point",
    "text-point",
    "text-point",
    "text-point",
    "text-point",
  ]);
  await expect(page.locator('[data-spacing-operation$="decrease-spacing"] figcaption code')).toContainText([
    "text-range",
    "text-range",
    "text-range",
    "text-range",
    "text-range",
  ]);
  await expect(page.locator("[data-correction-relation]")).toHaveCount(10);
  await expect(page.locator("[data-correction-relation]").first()).toContainText("→");
  await expect(page.locator('[data-coverage-status="DIRECT"]')).not.toHaveCount(0);
  await expect(page.locator('[data-coverage-status="GENERIC-FALLBACK"]')).not.toHaveCount(0);
  await expect(page.locator('[data-coverage-status="UNSUPPORTED"]')).not.toHaveCount(0);
  await expect(page.locator('[data-coverage-status="UNVERIFIED"]')).not.toHaveCount(0);
  await expect(page.getByRole("heading", { name: "文字・記号を取り替える" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "改正", exact: true })).toBeVisible();
  await expect(page.locator('[data-gallery-pack="gb"]').getByRole("heading", { name: "保留" })).toBeVisible();
  await expect(page.locator('[data-gallery-pack="cns"]').getByRole("heading", { name: "保留" })).toBeVisible();
  await expect(page.locator('[data-gallery-pack="cns"]').getByRole("heading", { name: "插字（增補）" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "글자 고치기 · 고침표" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "이전 교정 취소" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Delete · dele" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cancel correction · stet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "转移" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "띄움표", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Close up", exact: true })).toBeVisible();
  await expect(
    page.locator('[data-gallery-sheet="ks-replace-single-horizontal-tb"]'),
  ).toContainText("문장을 교정한댜.");
  await expect(
    page.locator('[data-gallery-sheet="en-delete-multi-horizontal-tb"]'),
  ).toContainText("The editor very carefully reviewed the manuscript.");
  const cnsProof = page.locator('[data-gallery-sheet="cns-replace-single-horizontal-tb"]');
  await expect(cnsProof).toContainText("文分需要校對。");
  await expect(cnsProof.locator('[data-operation="replace"]')).toHaveAttribute(
    "data-notation-id",
    "cns3927",
  );
  expect(await cnsProof.evaluate((element) => {
    const source = element.firstChild;
    if (!(source instanceof Text)) return "";
    const range = document.createRange();
    range.setStart(source, 1);
    range.setEnd(source, 2);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return selection?.toString() ?? "";
  })).toBe("分");
  const sectionOrder = await page.locator(".marks-page").evaluate((root) => {
    const native = root.querySelector(".native-specimens-intro");
    const mixed = root.querySelector(".mixed-proof-section");
    return native && mixed ? native.compareDocumentPosition(mixed) : 0;
  });
  expect(sectionOrder & 4).not.toBe(0);
});

test("marks filters preserve mounted specimens and technical metadata exposes real targets", async ({
  page,
}) => {
  await page.goto("/fixtures/marks");
  const englishClose = page.locator(
    '[data-gallery-sheet="en-decrease-spacing-horizontal-tb"] + [data-target-metadata]',
  );
  await expect(englishClose).toContainText("␠␠");
  await expect(englishClose).toContainText("SPACE · U+0020 · SPACE · U+0020");

  const stress = page.locator('[data-fixture-kind="multi-whitespace-stress"]');
  await expect(stress).toContainText("U+0009");
  await expect(stress).toContainText("U+00A0");
  await expect(stress).toContainText("TAB · U+0009");
  await expect(stress).toContainText("NO-BREAK SPACE · U+00A0");
  await expect(stress.locator('[data-operation="decrease-spacing"]')).toHaveCount(1);

  await expect(page.locator("[data-marks-filter-reset]")).toBeVisible();
  await expect(page.locator("[data-gallery-pack]:visible")).toHaveCount(1);
  await expect(page.locator("[data-gallery-mode]:visible")).toHaveCount(11);

  const gbOverlay = page.locator(
    '[data-gallery-sheet="gb-decrease-spacing-horizontal-tb"] [data-proofmarks-overlay]',
  );
  await gbOverlay.evaluate((overlay) => {
    (overlay as SVGSVGElement).dataset.filterIdentity = "preserved";
  });
  await page.locator('[data-marks-filter="notation"]').selectOption("gb");
  await page.locator('[data-marks-filter="operation"]').selectOption("decrease-spacing");
  await page.locator('[data-marks-filter="writing-mode"]').selectOption("horizontal-tb");
  await expect(page.locator("[data-marks-filter-reset]")).toBeVisible();
  await expect(page.locator("[data-gallery-pack]:visible")).toHaveCount(1);
  await expect(page.locator("[data-operation-filter]:visible")).toHaveCount(1);
  await expect(page.locator("[data-gallery-mode]:visible")).toHaveCount(1);
  await expect(gbOverlay).toHaveAttribute("data-filter-identity", "preserved");

  await page.getByRole("button", { name: "Show all marks" }).click();
  await expect(page.locator("[data-gallery-pack]:visible")).toHaveCount(5);
  await expect(page.locator("[data-operation-filter]:visible")).toHaveCount(40);
  await expect(gbOverlay).toHaveAttribute("data-filter-identity", "preserved");
});

test("canonical specimen bench remeasures size, line height, width, face, and appearance", async ({
  page,
}) => {
  await page.goto("/fixtures/marks");
  await page.locator(".specimen-controls summary").click();
  const sheet = page.locator('[data-gallery-sheet="jis-insert-horizontal-tb"]');
  const mark = sheet.locator('[data-proofmarks-role="insertion-anchor"]').first();
  await expect(mark).toBeVisible();
  const initial = await sheet.evaluate((element) => ({
    fontSize: getComputedStyle(element).fontSize,
    lineHeight: getComputedStyle(element).lineHeight,
    width: element.getBoundingClientRect().width,
  }));
  const initialStroke = await mark.getAttribute("stroke-width");

  await page.locator('[data-specimen-control="size"]').selectOption("32");
  await page.locator('[data-specimen-control="line-height"]').selectOption("2");
  await page.locator('[data-specimen-control="width"]').selectOption("280");
  await page.locator('[data-specimen-control="font"]').selectOption("sans");
  await expect(page.locator(".specimen-readout")).toContainText("32 px");
  await expect(sheet).toHaveCSS("font-size", "32px");
  await expect(sheet).toHaveCSS("line-height", "64px");
  await expect(sheet).toHaveCSS("font-family", /sans-serif/);
  await expect.poll(async () => mark.getAttribute("stroke-width")).not.toBe(initialStroke);
  const changed = await sheet.evaluate((element) => ({
    fontSize: getComputedStyle(element).fontSize,
    lineHeight: getComputedStyle(element).lineHeight,
    width: element.getBoundingClientRect().width,
  }));
  expect(changed.fontSize).not.toBe(initial.fontSize);
  expect(changed.lineHeight).not.toBe(initial.lineHeight);
  expect(changed.width).toBeLessThan(initial.width);

  await page.locator('[data-specimen-control="appearance"]').selectOption("editorial");
  await expect(sheet.locator("[data-operation]")).toHaveAttribute(
    "data-appearance",
    "editorial",
  );
  await expect(sheet.locator("[data-proofmarks-overlay]")).toHaveCount(1);
  await expect(sheet.locator('[data-proofmarks-role="inserted-text"]')).toHaveText("再");
  await expect(page.locator(".marks-page")).toHaveAttribute(
    "data-specimen-appearance",
    "editorial",
  );
  await expect(page.locator("[data-correction-relation]").first()).toBeHidden();
});

test("canonical marks stay attached through representative page zoom", async ({ page }) => {
  await page.goto("/fixtures/marks");
  const sheet = page.locator('[data-gallery-sheet="jis-insert-horizontal-tb"]');
  for (const zoom of [1.25, 1.5, 2]) {
    await page.evaluate((value) => {
      document.documentElement.style.zoom = String(value);
    }, zoom);
    await waitForRender(page);
    await expect(sheet.locator("[data-proofmarks-overlay]")).toHaveCount(1);
    await expect(sheet.locator('[data-proofmarks-role="insertion-anchor"]')).toHaveCount(2);
    await expect(sheet.locator('[data-proofmarks-role="inserted-text"]')).toBeVisible();
  }
});

test.describe("Task 009C high-density technical rendering", () => {
  test.use({ deviceScaleFactor: 2 });

  test("keeps clamped strokes and finite geometry at 2× device scale", async ({ page }) => {
    await page.goto("/fixtures/marks");
    await page.locator('[data-marks-filter="notation"]').selectOption("gb");
    const sheet = page.locator('[data-gallery-sheet="gb-delete-single-horizontal-tb"]');
    const values = await sheet.locator('[data-proofmarks-role="deletion-tail"]').evaluate(
      (path) => ({
        d: path.getAttribute("d") ?? "",
        strokeWidth: getComputedStyle(path).strokeWidth,
        dpr: window.devicePixelRatio,
      }),
    );
    expect(values.dpr).toBe(2);
    expect(values.d).not.toMatch(/NaN|Infinity/);
    expect(Number.parseFloat(values.strokeWidth)).toBeGreaterThanOrEqual(1.15);
    await expect(sheet.locator("[data-proofmarks-overlay]")).toHaveCount(1);
  });
});

test("English US gallery keeps native word, punctuation, replacement, transpose, and STET marks attached", async ({
  page,
}) => {
  await page.goto("/fixtures/marks");
  await page.locator('[data-marks-filter="notation"]').selectOption("en");
  const deleteSheet = page.locator(
    '[data-gallery-sheet="en-delete-multi-horizontal-tb"]',
  );
  const attachment = async () =>
    deleteSheet.evaluate((container) => {
      const text = container.firstChild;
      const overlay = container.querySelector<SVGSVGElement>("[data-proofmarks-overlay]");
      const line = container.querySelector<SVGLineElement>(
        '[data-proofmarks-role="target-stroke"]',
      );
      if (!text || !overlay || !line) return { attached: false, width: 0 };
      const range = document.createRange();
      range.setStart(text, 11);
      range.setEnd(text, 16);
      const target = range.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      const points = [
        [Number(line.getAttribute("x1")), Number(line.getAttribute("y1"))],
        [Number(line.getAttribute("x2")), Number(line.getAttribute("y2"))],
      ];
      return {
        attached: points.every(
          ([x, y]) =>
            overlayRect.left + x >= target.left - 4 &&
            overlayRect.left + x <= target.right + 4 &&
            overlayRect.top + y >= target.top - 4 &&
            overlayRect.top + y <= target.bottom + 4,
        ),
        width: target.width,
      };
    });
  expect(await attachment()).toMatchObject({ attached: true });
  await deleteSheet.evaluate((element) => {
    element.style.width = "19rem";
  });
  await waitForRender(page);
  expect(await attachment()).toMatchObject({ attached: true });
  await expect(deleteSheet.locator('[data-proofmarks-role="deletion-tail"]')).toHaveCount(1);

  const wordInsert = page.locator('[data-gallery-sheet="en-insert-horizontal-tb"]');
  expect(
    await wordInsert.locator('[data-proofmarks-role="inserted-text"]').textContent(),
  ).toBe("final ");
  await expect(wordInsert.locator('[data-proofmarks-role="insertion-anchor"]')).toHaveCount(2);
  const punctuationInsert = page.locator(
    '[data-gallery-sheet="en-insert-punctuation-horizontal-tb"]',
  );
  expect(
    await punctuationInsert
      .locator('[data-proofmarks-role="inserted-text"]')
      .textContent(),
  ).toBe(",");

  const replace = page.locator(
    '[data-gallery-sheet="en-replace-single-horizontal-tb"]',
  );
  await expect(replace.locator('[data-proofmarks-role="target-stroke"]')).toHaveCount(1);
  await expect(replace.locator('[data-proofmarks-role="deletion-tail"]')).toHaveCount(1);
  await expect(replace.locator('[data-proofmarks-role="replacement-text"]')).toHaveText(
    "reviewed",
  );

  const transpose = page.locator(
    '[data-gallery-sheet="en-transpose-group-horizontal-tb"]',
  );
  await expect(transpose.locator('[data-proofmarks-role="exchange-path"]')).toHaveCount(2);
  await expect(transpose.locator('[data-proofmarks-role="notation-label"]')).toHaveText("tr");

  const stet = page.locator(
    '[data-gallery-sheet="en-cancel-correction-horizontal-tb"]',
  );
  expect(await stet.locator('[data-proofmarks-role="retention-mark"]').count()).toBeGreaterThan(2);
  await expect(
    stet.locator(
      '[data-operation="cancel-correction"] [data-proofmarks-role="notation-label"]',
    ),
  ).toHaveText("stet");

  const unsupported = page.locator(
    '[data-gallery-sheet="en-delete-multi-vertical-rl"]',
  );
  await page.locator('[data-marks-filter="writing-mode"]').selectOption("all");
  await expect(unsupported.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-fidelity",
    "unsupported",
  );
  await expect(unsupported.locator("[data-proofmarks-role]")).toHaveCount(0);
});

test("English US workbench derives vertical unsupported state from the pack capability", async ({
  page,
}) => {
  await page.getByLabel("Notation").selectOption("en");
  await selectFixture(page, "delete-multi");
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-fidelity",
    "reference-based",
  );
  await page.getByLabel("Vertical").check();
  await waitForRender(page);
  await expect(page.locator('[data-operation="delete"]')).toHaveAttribute(
    "data-fidelity",
    "unsupported",
  );
  await expect(page.locator("#fidelity-status")).toHaveText("unsupported");
  await expect(page.locator("#scope-note")).toContainText("horizontal text only");
  await expect(page.locator("[data-proofmarks-role]")).toHaveCount(0);
});

test("compare view renders identical inputs through five independent notation scenes", async ({
  page,
}) => {
  await page.goto("/compare");
  await expect(page.locator("[data-compare-operation]")).toHaveCount(5);
  await expect(page.locator("[data-compare-sheet]")).toHaveCount(25);
  await expect(page.locator('[data-compare-operation="delete"]')).toHaveAttribute("open");
  await expect(page.locator('[data-compare-operation="insert"]')).not.toHaveAttribute("open");
  await page.locator('[data-compare-operation="insert"] > summary').click();
  await expect(page.locator('[data-compare-operation="insert"] [data-compare-sheet="insert-jis"]')).toBeVisible();

  for (const operation of ["delete", "insert", "replace", "transpose"] as const) {
    const comparison = page.locator(`[data-compare-operation="${operation}"]`);
    const sources = await comparison.locator("[data-compare-sheet]").evaluateAll((sheets) =>
      sheets.map((sheet) => sheet.firstChild?.textContent ?? ""),
    );
    expect(new Set(sources)).toHaveProperty("size", 1);
    await expect(
      comparison.locator('[data-compare-side="jis"] [data-operation]'),
    ).toHaveAttribute("data-notation-id", "ja-jis-z8208-reference");
    await expect(
      comparison.locator('[data-compare-side="gb"] [data-operation]'),
    ).toHaveAttribute("data-notation-id", "zh-gb-t14706-reference");
    await expect(
      comparison.locator('[data-compare-side="gb"] [data-operation]'),
    ).toHaveAttribute("data-fidelity", "reference-based");
    await expect(
      comparison.locator('[data-compare-side="cns"] [data-operation]'),
    ).toHaveAttribute("data-notation-id", "cns3927");
    await expect(
      comparison.locator('[data-compare-side="ks"] [data-operation]'),
    ).toHaveAttribute("data-notation-id", "ko-ks-a0104-reference");
    await expect(
      comparison.locator('[data-compare-side="ks"] [data-operation]'),
    ).toHaveAttribute("data-fidelity", "reference-based");
    await expect(
      comparison.locator('[data-compare-side="en"] [data-operation]'),
    ).toHaveAttribute("data-notation-id", "en-us-traditional-reference");
    await expect(
      comparison.locator('[data-compare-side="en"] [data-operation]'),
    ).toHaveAttribute("data-fidelity", "reference-based");
  }

  const relation = page.locator('[data-compare-operation="cancel-correction"]');
  await expect(relation.locator(".compare-case-header")).toHaveText("Cancel previous correction");
  const sources = await relation.locator("[data-compare-sheet]").evaluateAll((sheets) =>
    sheets.map((sheet) => sheet.firstChild?.textContent ?? ""),
  );
  expect(new Set(sources)).toHaveProperty("size", 1);
  await expect(
    relation.locator('[data-compare-side="jis"] [data-operation="cancel-correction"]'),
  ).toHaveAttribute("data-fidelity", "reference-based");
  await expect(
    relation.locator('[data-compare-side="gb"] [data-operation="cancel-correction"]'),
  ).toHaveAttribute("data-fidelity", "reference-based");
  await expect(
    relation.locator('[data-compare-side="cns"] [data-operation="cancel-correction"]'),
  ).toHaveAttribute("data-fidelity", "reference-based");
  await expect(
    relation.locator('[data-compare-side="ks"] [data-operation="cancel-correction"]'),
  ).toHaveAttribute("data-fidelity", "generic-fallback");
  await expect(
    relation.locator('[data-compare-side="en"] [data-operation="cancel-correction"]'),
  ).toHaveAttribute("data-fidelity", "reference-based");
  await expect(
    relation.locator(
      '[data-compare-side="jis"] [data-operation="cancel-correction"] [data-proofmarks-role="notation-label"]',
    ),
  ).toHaveText("イキ");
  await expect(
    relation.locator('[data-compare-side="gb"] [data-proofmarks-role="retention-mark"]'),
  ).toHaveCount(1);
  await expect(
    relation.locator('[data-compare-side="cns"] [data-proofmarks-role="retention-mark"]'),
  ).toHaveCount(1);
  expect(
    await relation
      .locator('[data-compare-side="en"] [data-proofmarks-role="retention-mark"]')
      .count(),
  ).toBeGreaterThan(2);
  await expect(
    relation.locator(
      '[data-compare-side="en"] [data-operation="cancel-correction"] [data-proofmarks-role="notation-label"]',
    ),
  ).toHaveText("stet");
  await expect(relation.locator("[data-compare-semantic]")).toContainText(
    '"correctionId": "delete-original"',
  );
  await expect(page.locator("[data-compare-semantic]")).toHaveCount(5);
});
