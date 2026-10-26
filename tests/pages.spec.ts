import { expect, test } from "@playwright/test";

const base = process.env.PROOFMARKS_SITE_BASE ?? "/proofmarks/";

for (const route of ["", "get-started/", "marks/", "docs/", "demo/", "suggest/", "compare/", "workbench/", "dx/", "layout/"]) {
  test(`static Pages direct load and refresh: ${route || "home"}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    expect((await page.goto(`${base}${route}`))?.status()).toBe(200);
    await expect(page.locator("#app")).not.toBeEmpty();
    await expect(page.locator("h1")).toBeVisible();
    await page.reload();
    await expect(page.locator("h1")).toBeVisible();
    const links = await page.locator('a[href^="/"]').evaluateAll(elements => elements.map(element => element.getAttribute("href")!));
    expect(links.every(link => link.startsWith(base))).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("navigation, language chunks, proof marks and aliases work below the project path", async ({ page, request }) => {
  await page.goto(`${base}?lang=ja`);
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await page.locator('.site-navigation a[href*="/marks"]').click();
  await expect(page).toHaveURL(new RegExp(`${base}marks/\\?lang=ja$`));
  await expect(page.locator("[data-proofmarks-overlay]").first()).toBeVisible();
  await expect(page.locator(".site-language select")).toHaveValue("ja");
  await page.goto(`${base}references/?lang=ko`);
  await expect(page).toHaveURL(`${base}docs/?lang=ko#references`);
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await page.goto(`${base}playground/?lang=zh-Hant#example`);
  await expect(page).toHaveURL(`${base}get-started?lang=zh-Hant#example`);
  await expect(page.locator(".proof-text [data-proofmarks-overlay]").first()).toBeVisible();
  expect((await request.get(`${base}llms.txt`)).status()).toBe(200);
  expect((await request.get(`${base}missing-page/`)).status()).toBe(404);
});
