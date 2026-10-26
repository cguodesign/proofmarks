import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { codeFor, invitation, retainOriginal, scenes, segmentsFor } from "../apps/playground/src/demo/scenes";

// These tests assert English site copy; pin the browser language explicitly.
test.use({ locale: "en-US" });

async function source(page: Page) {
  return page.locator(".story-proof").evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let text = "";
    while (walker.nextNode()) {
      if (!walker.currentNode.parentElement?.closest("svg")) text += walker.currentNode.textContent;
    }
    return text;
  });
}

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("story entry, chapter navigation and a reversible proof preserve source text", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("link", { name: "Demo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "採用通知" })).toBeVisible();
  const proof = page.locator(".story-proof");
  await expect(proof).toHaveCSS("writing-mode", "vertical-rl");
  await expect(proof.locator("svg")).toHaveCSS("visibility", "hidden");
  expect(await source(page)).toBe(scenes[0]!.source);
  await page.locator("[data-ink-target]").click();
  await expect(proof.locator('[data-correction-id="arrival-department"]')).toBeVisible();
  await expect(proof.locator("svg")).toContainText("校閲部");
  await page.getByRole("button", { name: "收起红笔", exact: true }).click();
  await expect(proof.locator("svg")).toHaveCSS("visibility", "hidden");
  expect(await source(page)).toBe(scenes[0]!.source);
  await page.getByRole("button", { name: "显示红笔", exact: true }).click();
  await page.getByRole("link", { name: "下一页", exact: true }).click();
  await expect(page).toHaveURL(/#column$/);
  await expect(page.getByRole("heading", { name: "认真看见" })).toBeFocused();
  await page.locator("[data-ink-target]").click();
  await expect(proof.locator("[data-correction-id]")).toHaveCount(1);
  await page.locator("[data-ink-target]").click();
  await expect(proof.locator("[data-correction-id]")).toHaveCount(2);
  await page.getByRole("button", { name: "切换至繁体邀请函" }).click();
  await expect(proof).toHaveAttribute("lang", "zh-Hant-TW");
  expect(await source(page)).toBe(invitation.source);
  await page.locator("[data-ink-target]").click();
  await expect(proof.locator("svg")).toContainText("份");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "採用通知" })).toBeVisible();
  await expect(proof.locator("svg")).toHaveCSS("visibility", "visible");
  expect(errors).toEqual([]);
});

test("subtitle choice persists across keyboard paging without taking over the code panel", async ({ page }) => {
  await page.goto("/demo");
  const language = page.getByRole("combobox", { name: "字幕语言" });
  await expect(language.locator("xpath=ancestor::*[contains(@class, 'story-utility')]")).toContainText("〈/〉");
  await language.selectOption("en");
  await page.locator('button[aria-controls="story-docs"]').focus();
  await expect(page.locator(".story-caption")).toHaveText("A fashion editor. You had even planned what to wear on day one.");
  await expect(page.locator(".story-caption")).toHaveAttribute("lang", "en");

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#column$/);
  await expect(page.locator(".story-caption")).toHaveText("First assignment: proofread an editorial about paying attention.");

  await page.locator('button[aria-controls="story-docs"]').click();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#column$/);
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/#arrival$/);
});

test("evidence, reflow, formatted English and cancellation complete the story", async ({ page }) => {
  await page.goto("/demo#walk");
  await page.getByText("查看外勤记录", { exact: true }).click();
  await expect(page.locator(".story-evidence")).toContainText("16:55");
  await page.locator("[data-ink-target]").click();
  const before = await page.locator(".story-proof").boundingBox();
  await page.getByRole("button", { name: "收窄稿纸", exact: false }).click();
  const after = await page.locator(".story-proof").boundingBox();
  expect(after!.width).toBeLessThan(before!.width);
  await expect(page.locator('[data-correction-id="walk-duration"]')).toBeVisible();
  expect(await source(page)).toBe(scenes[2]!.source);
  await page.getByRole("link", { name: "下一页", exact: true }).click();
  await expect(page.locator(".story-proof em")).toHaveText("Side Streets");
  await expect(page.locator(".story-proof strong").first()).toHaveText("17:25");
  await expect(page.getByRole("link", { name: "walking route" })).toHaveAttribute("href", "/demo#walk");
  await page.locator("[data-ink-target]").click();
  await page.locator("[data-ink-target]").click();
  await expect(page.locator(".story-proof svg")).toContainText("17:05");
  expect(await source(page)).toBe(scenes[3]!.source);
  await page.getByRole("link", { name: "下一页", exact: true }).click();
  await page.locator("[data-ink-target]").click();
  await page.locator("[data-ink-target]").click();
  await expect(page.locator('[data-correction-id="letter-retain"]')).toBeVisible();
  await expect(page.locator(".story-proof svg")).toContainText("イキ");
  expect(await source(page)).toBe(scenes[4]!.source);
  await page.getByRole("button", { name: "交付定稿", exact: true }).click();
  await expect(page.locator(".story-caption")).toHaveText("创刊号，付印。你的第一天，完成。");
  await expect(page.getByRole("link", { name: /自己拿起红笔/ })).toHaveAttribute("href", "/get-started");
  await page.getByRole("button", { name: "重新读一遍" }).click();
  await expect(page).toHaveURL(/#arrival$/);
  await expect(page.locator(".story-proof svg")).toHaveCSS("visibility", "hidden");
});

test("per-scene documentation copies runnable source and restores focus", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/demo#train");
  const toggle = page.locator('button[aria-controls="story-docs"]');
  await toggle.click();
  await expect(page.locator("#story-docs")).toBeFocused();
  await expect(page.locator("#story-docs code")).toContainText("enUS");
  await page.getByRole("button", { name: "查看代码", exact: true }).click();
  await expect(page.locator("#story-docs code")).toContainText("<em>");
  await expect(page.locator("#story-docs code")).toContainText('"train-departure"');
  await page.getByRole("button", { name: "复制代码", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已复制");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await page.locator("#story-docs code").textContent());
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(page.locator("#story-docs")).toHaveCount(0);
});

for (const width of [320, 390, 768]) {
test(`all native proofs fit at ${width}px with reduced motion`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  for (const scene of scenes) {
    await page.goto(`/demo#${scene.id}`);
    for (const correction of scene.corrections) {
      await page.locator(`[data-ink-target="${correction.id}"]`).click();
    }
    await expect(page.locator(".story-paper")).toHaveCSS("animation-name", "none");
    expect(await source(page)).toBe(scene.source);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const paper = await page.locator(".story-paper").boundingBox();
    const labels = await page.locator(".story-proof svg text").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
    for (const label of labels) {
      expect(label.x).toBeGreaterThanOrEqual(paper!.x - 1);
      expect(label.right).toBeLessThanOrEqual(paper!.x + paper!.width + 1);
      expect(label.bottom).toBeLessThanOrEqual(paper!.y + paper!.height + 1);
    }
  }
});
}

test("copyable examples bundle against the real public package", async () => {
  for (const scene of [...scenes, invitation]) {
    expect(segmentsFor(scene).map(({ text }) => text).join("")).toBe(scene.source);
    const corrections = scene.id === "letter" ? [...scene.corrections, retainOriginal] : scene.corrections;
    const result = await build({
      stdin: { contents: codeFor(scene, corrections), loader: "tsx", resolveDir: `${process.cwd()}/apps/playground` },
      bundle: true,
      write: false,
      outfile: "demo-snippet.js",
      format: "esm",
      external: ["react", "react/jsx-runtime"],
      jsx: "automatic",
      logLevel: "silent",
    });
    expect(result.errors).toEqual([]);
  }
});


test("drawing on the paper reveals one correction without blocking ordinary selection", async ({ page }) => {
  await page.goto("/demo#arrival");
  await expect(page.locator(".story-action")).toHaveCount(0);
  const target = page.locator("[data-ink-target]");
  await expect(target).toBeVisible();
  await expect(page.locator(".story-paper")).toHaveCSS("cursor", /data:image\/svg/);
  await page.getByRole("heading", { name: "採用通知" }).click();
  await expect(page.locator("[data-correction-id]")).toHaveCount(0);
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height - 5, { steps: 8 });
  await expect(page.locator(".story-pen-stroke polyline")).toBeVisible();
  await expect(page.locator("[data-correction-id]")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('[data-correction-id="arrival-department"]')).toBeVisible();
  await expect(target).toHaveCount(0);
  expect(await source(page)).toBe(scenes[0]!.source);
  const selection = await page.locator(".story-proof").evaluate((root) => {
    const range = document.createRange();
    range.selectNodeContents(root.firstChild!);
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    return selection.toString();
  });
  expect(selection).toContain("ファッション編集部");
});

test("paper hints are keyboard operable and subtitle changes leave the manuscript intact", async ({ page }) => {
  await page.goto("/demo#column");
  const original = await source(page);
  for (const language of ["en", "ja", "ko", "zh-Hant", "zh-Hans"]) {
    await page.locator(".story-subtitle-control").getByRole("combobox").selectOption(language);
    await expect(page.locator(".story-caption")).toHaveAttribute("lang", language);
    expect(await source(page)).toBe(original);
    await expect(page.locator(".story-proof")).toHaveAttribute("lang", "zh-Hans");
  }
  await page.locator("[data-ink-target]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-correction-id]")).toHaveCount(1);
  await page.locator("[data-ink-target]").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-correction-id]")).toHaveCount(2);
  await expect(page.locator("[data-ink-target]")).toHaveCount(0);
});

test("an interrupted pen stroke does not apply a correction", async ({ page }) => {
  await page.goto("/demo#arrival");
  const target = page.locator("[data-ink-target]");
  await expect(target).toBeVisible();
  const box = (await target.boundingBox())!;
  await target.focus();
  await page.mouse.move(box.x + 12, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + 12, box.y + 35);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".story-pen-stroke")).toHaveCount(0);
  await expect(page.locator("[data-correction-id]")).toHaveCount(0);
  await expect(target).toBeVisible();
});

test("a touch user can tap the drawing hint", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/demo#arrival`);
    await page.locator("[data-ink-target]").tap();
    await expect(page.locator('[data-correction-id="arrival-department"]')).toBeVisible();
    expect(await source(page)).toBe(scenes[0]!.source);
    await expect(page.getByRole("combobox", { name: "字幕语言" })).toBeVisible();
  } finally {
    await context.close();
  }
});
