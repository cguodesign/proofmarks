import { expect, test, type Page } from "@playwright/test";

// These tests assert English site copy; pin the browser language explicitly.
test.use({ locale: "en-US" });

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );
}

async function selectWorkbenchFixture(page: Page, fixture: string): Promise<void> {
  await page.goto("/workbench");
  await page.getByLabel("Notation").selectOption("jis");
  await page.getByLabel("Fixture").selectOption(fixture);
  await settle(page);
}

async function expectFiniteScene(page: Page, operation: string): Promise<void> {
  const groups = page.locator(`[data-operation="${operation}"]`);
  await expect(groups).not.toHaveCount(0);
  const audit = await groups.evaluateAll((nodes) => ({
    connected: nodes.every((node) => node.isConnected),
    invalidGeometry: nodes.some((node) => /NaN|Infinity/.test(node.outerHTML)),
    overlays: new Set(nodes.map((node) => node.closest("[data-proofmarks-overlay]"))).size,
  }));
  expect(audit.connected).toBe(true);
  expect(audit.invalidGeometry).toBe(false);
  expect(audit.overlays).toBe(1);
}

for (const [label, fixture, operation] of [
  ["horizontal delete", "delete-multi", "delete"],
  ["insert", "insert", "insert"],
  ["replace", "replace-single", "replace"],
  ["transpose", "transpose-group", "transpose"],
  ["move", "move", "move"],
  ["increase-spacing", "increase-spacing", "increase-spacing"],
  ["decrease-spacing", "decrease-spacing", "decrease-spacing"],
  ["cancel-correction", "cancel-correction", "cancel-correction"],
] as const) {
  test(`release matrix: ${label}`, async ({ page }) => {
    await selectWorkbenchFixture(page, fixture);
    await expectFiniteScene(page, operation);
  });
}

test("release matrix: multi-correction dense proof", async ({ page }) => {
  await page.goto("/layout");
  await page.getByRole("button", { name: "Dense · 12" }).click();
  await settle(page);
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);
  await expect(page.locator("[data-correction-id]")).toHaveCount(12);
  expect(
    await page.locator("[data-correction-id]").evaluateAll((nodes) =>
      nodes.every((node) => !/NaN|Infinity/.test(node.outerHTML)),
    ),
  ).toBe(true);
});

test("release matrix: vertical JIS", async ({ page }) => {
  await selectWorkbenchFixture(page, "replace-single");
  await page.getByLabel("Vertical").check();
  await settle(page);
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveAttribute(
    "data-writing-mode",
    "vertical-rl",
  );
  await expectFiniteScene(page, "replace");
});

test("release matrix: nested DOM range", async ({ page }) => {
  await page.goto("/dx");
  const proof = page.locator(".dx-proof");
  await proof.evaluate((element) => {
    const overlay = element.querySelector("[data-proofmarks-overlay]");
    const nested = document.createElement("span");
    nested.dataset.releaseNestedRange = "";
    nested.textContent = "名前";
    element.replaceChildren(
      document.createTextNode("吾輩は猫である。"),
      nested,
      document.createTextNode("はまだ無い。"),
      ...(overlay ? [overlay] : []),
    );
  });
  await settle(page);
  await expect(proof.locator("[data-release-nested-range]")).toHaveText("名前");
  await expect(proof.locator("[data-proofmarks-overlay]")).toHaveCount(1);
  await expectFiniteScene(page, "delete");
});

test("release matrix: editorial appearance", async ({ page }) => {
  await page.goto("/layout");
  await page.getByRole("button", { name: "Editorial", exact: true }).click();
  await settle(page);
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveAttribute(
    "data-proofmarks-appearance",
    "editorial",
  );
  expect(await page.locator("[data-proofmarks-second-pass]").count()).toBeGreaterThan(0);
});

test("release matrix: reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/layout");
  await page.getByRole("button", { name: "Editorial", exact: true }).click();
  await settle(page);
  await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(1);
  await expect(page.locator("[data-correction-id]")).not.toHaveCount(0);
  await expect(page.locator(".proofmarks-write-on").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("release matrix: guided example updates source-preserving suggestions", async ({ page }) => {
  await page.goto("/get-started");
  await page.getByLabel("Language & notation", { exact: true }).selectOption("gb");
  const proof = page.locator('[data-example="replace"] .proof-text');
  await expect(proof.locator("[data-correction-id]")).toHaveCount(1);
  const original = await proof.evaluate(element => element.firstChild?.textContent);
  await page.getByLabel("Try yourself · replacement word").fill("校对者");
  await page.getByRole("button", { name: "Apply replacement" }).click();
  await expect(proof).toContainText("校对者");
  expect(await proof.evaluate(element => element.firstChild?.textContent)).toBe(original);
});
