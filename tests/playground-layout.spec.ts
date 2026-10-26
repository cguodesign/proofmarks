import { expect, test } from "@playwright/test";
import { transform } from "esbuild";

// These tests assert English site copy; pin the browser language explicitly.
test.use({ locale: "en-US" });

const languages = [
  ["enUS", "en"], ["jis", "ja"], ["gb", "zh-Hans"],
  ["cns3927", "zh-Hant-TW"], ["ks", "ko"],
] as const;

test("get started has two complete, copyable, unfolded examples", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/get-started");
  await expect(page).toHaveTitle("Get started — proofmarks");
  await expect(page.locator("main details, main summary, main [role=tablist]")).toHaveCount(0);
  await expect(page.locator(".guide-basic-example")).toHaveCount(2);
  await expect(page.locator(".guide-example-result [data-correction-id]")).toHaveCount(2);
  for (const [id, lang] of languages) {
    await page.getByLabel("Language & notation", { exact: true }).selectOption(id);
    for (const operation of ["replace", "insert"]) {
      const section = page.locator(`[data-example="${operation}"]`);
      await expect(section.locator(".proof-text")).toHaveAttribute("lang", lang);
      const code = await section.locator("pre").innerText();
      expect(code).toContain('import "proofmarks/styles.css"');
      expect(code).toContain("export default function App");
      await transform(code, { loader: "tsx" });
      await section.getByRole("button", { name: `Copy App.tsx · ${operation}`, exact: true }).click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(code);
    }
  }
});

test("try yourself updates code and notation while preserving selectable source", async ({ page }) => {
  await page.goto("/get-started");
  for (const [type, label, value] of [["replace", "replacement word", "author"], ["insert", "text to insert", "revised "]] as const) {
    const section = page.locator(`[data-example="${type}"]`);
    const proof = section.locator(".proof-text");
    const source = () => proof.evaluate(element => element.firstChild?.textContent);
    const original = await source();
    const resultBox = await proof.boundingBox();
    const formBox = await section.locator("form").boundingBox();
    expect(formBox!.y - (resultBox!.y + resultBox!.height)).toBeLessThan(64);
    await section.getByLabel(`Try yourself · ${label}`).fill(value);
    await section.getByRole("button", { name: /^Apply / }).click();
    await expect(proof).toContainText(value.trim());
    await expect(section.locator("pre")).toContainText(JSON.stringify(value));
    expect(await source()).toBe(original);
  }
});

for (const [language, lang] of languages) {
  test(`catalog renders all ${language} operations with truthful support and common source`, async ({ page }) => {
    await page.goto("/marks");
    await page.getByLabel("Language & notation", { exact: true }).selectOption(language);
    await expect(page.locator("tbody tr")).toHaveCount(8);
    await expect(page.locator(".catalog-table [data-proofmarks-overlay]")).toHaveCount(8);
    await expect(page.locator("main details, main summary, aside")).toHaveCount(0);
    const rows = page.locator("tbody tr");
    let source = "";
    for (const row of await rows.all()) {
      const proof = row.locator(".proof-text");
      await expect(proof).toHaveAttribute("lang", lang);
      const text = await proof.evaluate(element => element.firstChild?.textContent ?? "");
      if (!source) source = text;
      expect(text.replace(/\s/g, "")).toBe(source.replace(/\s/g, ""));
      expect(await row.locator("[data-correction-id]").count()).toBeGreaterThan(0);
      const expected = await row.getAttribute("data-support");
      if (expected === "Reference-based") await expect(row.locator('[data-fidelity="generic-fallback"]')).toHaveCount(0);
      else await expect(row.locator('[data-fidelity="generic-fallback"]').first()).toBeAttached();
      expect(await proof.innerHTML()).not.toMatch(/NaN|Infinity/);
    }
    await page.getByLabel("Writing mode", { exact: true }).selectOption("vertical-rl");
    if (language === "enUS") {
      await expect(page.locator('[data-support="Unsupported"]')).toHaveCount(8);
      await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(0);
    } else {
      await expect(page.locator("[data-proofmarks-overlay]")).toHaveCount(8);
      for (const row of await rows.all()) {
        const expected = await row.getAttribute("data-support");
        if (expected === "Reference-based") await expect(row.locator('[data-fidelity="generic-fallback"]')).toHaveCount(0);
        else await expect(row.locator('[data-fidelity="generic-fallback"]').first()).toBeAttached();
      }
    }
  });
}

test("catalog settings affect the actual marks, reset cleanly, and keep quiet table rules", async ({ page }) => {
  await page.goto("/marks");
  const mark = page.locator('path[data-proofmarks-role], line[data-proofmarks-role]').first();
  await expect(mark).toBeAttached();
  const stroke = () => mark.evaluate(element => parseFloat(getComputedStyle(element).strokeWidth));
  const thin = await stroke();
  const slider = page.getByRole("slider", { name: "Line weight" });
  await slider.focus();
  await slider.press("End");
  await expect.poll(stroke).toBeCloseTo(thin * 2);
  await page.getByLabel("Ink", { exact: true }).fill("#123456");
  await expect(mark).toHaveCSS("stroke", "rgb(18, 52, 86)");
  await page.getByRole("button", { name: "Reset style" }).click();
  await expect(slider).toHaveValue("0.75");
  await expect(mark).toHaveCSS("stroke", "rgb(179, 38, 30)");
  for (const cell of await page.locator(".catalog-table th, .catalog-table td").all()) {
    await expect(cell).toHaveCSS("border-left-width", "0px");
    await expect(cell).toHaveCSS("border-right-width", "0px");
  }
});

test("Docs extends the basics with visible references; the old references URL redirects", async ({ page }) => {
  await page.goto("/references");
  await expect(page).toHaveURL(/\/docs#references$/);
  await expect(page.locator(".guide-reference")).toHaveCount(5);
  await expect(page.locator("main details, main summary")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "References" })).toHaveCount(0);
  for (const id of ["corrections", "notation", "react", "vanilla", "helpers", "room", "lifecycle", "editing", "marker-style", "motion", "writing-modes", "unsupported", "compatibility", "agents", "references", "visual-sources"]) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.locator("#references")).toContainText("redistribution permission has not been obtained");
  await expect(page.locator("#visual-sources")).toContainText("CC BY 4.0");
});

test("Docs examples reserve the shared room and leave no unused locals", async ({ page }) => {
  await page.goto("/docs");
  for (const label of ["React", "Vanilla TypeScript", "Appearance and ink"]) {
    const code = await page.locator(`pre[aria-label="${label}"]`).innerText();
    expect(code).toMatch(/44px 20px/);
    expect(code).toMatch(/1\.8/);
  }
  const vanilla = await page.locator('pre[aria-label="Vanilla TypeScript"]').innerText();
  expect(vanilla).toContain("export function clearSuggestions");
  expect(vanilla).toContain("export function unmountProof");
  const targets = await page.locator('pre[aria-label="Targets"]').innerText();
  expect(targets).toContain("findRange");
  expect(targets).not.toContain("indexOf");
  await expect(page.locator("#helpers")).toContainText("proofmarks/helpers");
  const helpers = await page.locator('pre[aria-label="proofmarks/helpers"]').innerText();
  expect(helpers).toContain("const element = document.querySelector<HTMLElement>");
  expect(helpers).toContain("console.log(editor, second, picked);");
  await expect(page.locator("#room [data-proofmarks-overlay]")).toHaveCount(2);
  await expect(page.locator("#compatibility")).toContainText("MIT");
  await expect(page.locator("#writing-modes")).toContainText("unverified-direction");
});

for (const width of [375, 640, 1440]) {
  test(`public guides stay fully visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/get-started", "/marks", "/docs"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.locator("main details, main summary")).toHaveCount(0);
      await page.screenshot({ path: `/tmp/proofmarks-${route.slice(1)}-${width}.png`, fullPage: true });
    }
  });
}
