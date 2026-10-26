import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ locale: "en-US" });

const highlightedText = (sample: Locator) =>
  sample.locator("mark.guide-code-line").evaluateAll((lines) => lines.map((line) => (line.textContent ?? "").trim()));

async function auditSamples(page: Page, route: string) {
  await page.goto(route);
  const samples = page.locator("figure.guide-code");
  await expect(samples.first()).toBeVisible();
  const count = await samples.count();
  expect(count, `${route} code samples`).toBeGreaterThan(0);
  for (let index = 0; index < count; index++) {
    const sample = samples.nth(index);
    const label = await sample.locator("pre").getAttribute("aria-label");
    const lines = (await sample.getAttribute("data-highlighted-lines")) ?? "";
    expect(lines, `${route} ${label} has highlighted lines`).toMatch(/^\d+(,\d+)*$/);
    expect(await sample.locator("mark.guide-code-line").count()).toBe(lines.split(",").length);
    // The marked line numbers are the rendered line positions.
    const positions = await sample.locator(".guide-code-line").evaluateAll((all) =>
      all.flatMap((line, at) => line.tagName === "MARK" ? [String(at + 1)] : []));
    expect(positions.join(",")).toBe(lines);
    // Screen readers get the whole code plus a description of the highlight.
    const description = await sample.locator("pre").getAttribute("aria-describedby");
    expect(description).toBeTruthy();
    await expect(page.locator(`[id="${description}"]`)).toHaveText(/^Highlighted lines? [\d–, ]+ of \d+\.$/);
    // Copy writes the full, clean source, identical to what the reader sees.
    const shown = await sample.locator("pre").innerText();
    expect(shown).not.toMatch(/[⟦⟧]/u);
    await sample.getByRole("button", { name: `Copy ${label}`, exact: true }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(shown);
  }
}

test("every public code sample highlights its relevant lines and copies clean source", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await auditSamples(page, "/get-started");
  await auditSamples(page, "/docs");
  await auditSamples(page, "/marks");
});

test("Get started highlights follow the step and the Try yourself values", async ({ page }) => {
  await page.goto("/get-started");
  const replace = page.locator('[data-example="replace"] figure.guide-code');
  await expect.poll(() => highlightedText(replace)).toEqual([
    'target: { kind: "text-range", start: 4, end: 10 },',
    'replacement: "writer",',
  ]);
  const insert = page.locator('[data-example="insert"] figure.guide-code');
  await expect.poll(() => highlightedText(insert)).toEqual([
    'target: { kind: "text-point", offset: 15 },',
    'content: "carefully ",',
  ]);

  await page.getByLabel("Try yourself · replacement word").fill("author");
  await page.getByRole("button", { name: "Apply replacement" }).click();
  await expect.poll(() => highlightedText(replace)).toEqual([
    'target: { kind: "text-range", start: 4, end: 10 },',
    'replacement: "author",',
  ]);

  await page.getByLabel("Language & notation", { exact: true }).selectOption("jis");
  const notation = page.locator("#language figure.guide-code");
  await expect(notation.locator("mark.guide-code-token")).toHaveText(["jis", "notation={jis}", 'lang="ja"']);
  await expect.poll(() => highlightedText(replace)).toEqual([
    'target: { kind: "text-range", start: 0, end: 3 },',
    'replacement: "著者",',
  ]);
});

test("Docs highlights point at the feature each section explains", async ({ page }) => {
  await page.goto("/docs");
  const sample = (section: string, label?: string) =>
    page.locator(`#${section} figure.guide-code`).filter(label ? { has: page.locator(`pre[aria-label="${label}"]`) } : {});
  await expect.poll(() => highlightedText(sample("room"))).toEqual(["padding: 44px 20px;", "line-height: 1.8;"]);
  await expect.poll(() => highlightedText(sample("motion"))).toEqual(["animate={false}", "proof.replay();"]);
  await expect(sample("writing-modes").locator("mark.guide-code-token")).toHaveText(['writingMode: "vertical-rl"']);
  const customization = await highlightedText(sample("marker-style", "Appearance and ink"));
  expect(customization[0]).toBe('appearance="editorial"');
  expect(customization[1]).toBe("markStyle={{");
  expect(customization).not.toContain("style={{ padding: \"44px 20px\", lineHeight: 1.8 }}");
  const lifecycle = await highlightedText(sample("lifecycle"));
  expect(lifecycle).toEqual(["} catch (error) {", "onIssue={(issue) => {", 'if (issue.code === "invalid-corrections") {']);
  await expect(sample("helpers").locator("mark.guide-code-token")).toHaveText([
    "getSourceText(element)", 'findRange(text, "editor")', 'findRange(text, "the", 1)',
    "offsetsFromSelection(element, getSelection()!.getRangeAt(0))",
    'correctionsFromDiff(text, "The writer reads.", {', "applyCorrections(text, corrections)",
  ]);
});

test("highlighted samples stay inside a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/get-started", "/docs"]) {
    await page.goto(route);
    await expect(page.locator("mark.guide-code-line").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // Highlight bands span the scrollable code width, not just the visible part.
    const bands = await page.locator("mark.guide-code-line").evaluateAll((marks) =>
      marks.map((mark) => mark.getBoundingClientRect().width - (mark.parentElement?.scrollWidth ?? 0)));
    for (const difference of bands) expect(Math.abs(difference)).toBeLessThanOrEqual(1);
  }
});
