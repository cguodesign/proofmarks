import { expect, test, type Page } from "@playwright/test";
import { en } from "../apps/playground/src/i18n/en";
import { ja } from "../apps/playground/src/i18n/ja";
import { ko } from "../apps/playground/src/i18n/ko";
import { zhHans } from "../apps/playground/src/i18n/zh-hans";
import { zhHant } from "../apps/playground/src/i18n/zh-hant";

const dictionaries = { en, ja, "zh-Hans": zhHans, "zh-Hant": zhHant, ko } as const;
type Locale = keyof typeof dictionaries;
const locales = Object.keys(dictionaries) as Locale[];
const routes = [
  { path: "/", heading: (t: typeof en) => t.home.heroTitle.replace("\n", "") },
  { path: "/get-started", heading: (t: typeof en) => t.getStarted.title },
  { path: "/docs", heading: (t: typeof en) => t.docs.title },
  { path: "/marks", heading: (t: typeof en) => t.marks.title },
] as const;

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.use({ locale: "en-US" });

for (const locale of locales) {
  test(`${locale}: public pages are fully localized`, async ({ page }) => {
    const t = dictionaries[locale];
    const errors = trackErrors(page);
    for (const route of routes) {
      await page.goto(`${route.path}?lang=${locale}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(route.heading(t));
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator(".site-language select")).toHaveValue(locale);
      const primary = page.getByRole("navigation", { name: t.common.primaryNavigation });
      const labels = (await primary.getByRole("link").allInnerTexts()).map((label) => label.trim());
      expect(labels).toEqual([t.common.nav.demo, t.common.nav.getStarted, t.common.nav.marks, t.common.nav.docs]);
      if (locale !== "en") {
        for (const label of labels) expect(Object.values(en.common.nav), `${route.path} nav "${label}"`).not.toContain(label);
        const footer = await page.getByRole("navigation", { name: t.common.footerNavigation }).getByRole("link").allInnerTexts();
        expect(footer.map((label) => label.replace("↗", "").trim()).filter((label) => label !== "GitHub"))
          .toEqual([t.common.footerDocs, t.common.footerReferences]);
        expect(await page.locator(".skip-link").textContent()).toBe(t.common.skipLink);
      }
      if (route.path !== "/") await expect(page).toHaveTitle(`${route.heading(t)} — re:proofmarks`);
      else await expect(page).toHaveTitle(t.meta.homeTitle);
      await expect(page.locator("[data-proofmarks-overlay]").first()).toBeAttached();
    }
    expect(errors).toEqual([]);
  });
}

test("CJK pages fit a 390px phone without horizontal page scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const locale of ["ja", "zh-Hans", "zh-Hant", "ko"] as const) {
    for (const route of routes) {
      await page.goto(`${route.path}?lang=${locale}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${locale} ${route.path}`).toBeLessThanOrEqual(390);
    }
  }
});

test("the header switcher changes language in place and persists across navigation", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/marks");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".catalog-table [data-proofmarks-overlay]")).toHaveCount(8);
  const switcher = page.getByLabel(en.common.language, { exact: true });
  await expect(switcher.locator("option")).toHaveText(["English", "日本語", "简体中文", "繁體中文", "한국어"]);
  await switcher.selectOption("ja");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(ja.marks.title);
  await expect(page).toHaveURL(/\/marks\?lang=ja$/);
  // Live proofs keep rendering after the UI language changes.
  await expect(page.locator(".catalog-table [data-proofmarks-overlay]")).toHaveCount(8);
  await page.getByLabel(ja.common.languageAndNotation, { exact: true }).selectOption("ks");
  await expect(page.locator(".catalog-table [data-proofmarks-overlay]")).toHaveCount(8);
  await expect(page.locator(".catalog-table td").first()).toHaveAttribute("data-label", ja.marks.result);

  // Internal links keep the language; the choice also survives a plain URL.
  const docsLink = page.getByRole("navigation", { name: ja.common.primaryNavigation }).getByRole("link", { name: ja.common.nav.docs });
  await expect(docsLink).toHaveAttribute("href", "/docs?lang=ja");
  await docsLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(ja.docs.title);
  await page.goto("/get-started");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(ja.getStarted.title);
  await expect(page.locator(".guide-example-result [data-proofmarks-overlay]")).toHaveCount(2);

  await page.getByLabel("言語 (Language)", { exact: true }).selectOption("zh-Hant");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(zhHant.getStarted.title);
  await expect(page.locator(".guide-example-result [data-proofmarks-overlay]")).toHaveCount(2);
  await expect(page.locator(".guide-code mark.guide-code-line").first()).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  expect(errors).toEqual([]);
});

for (const [browserLocale, expected] of [["zh-TW", "zh-Hant"], ["zh-HK", "zh-Hant"], ["zh-CN", "zh-Hans"], ["ja-JP", "ja"], ["ko-KR", "ko"], ["fr-FR", "en"]] as const) {
  test(`first visit with ${browserLocale} picks ${expected}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: browserLocale });
    const page = await context.newPage();
    await page.goto(`${baseURL}/docs`);
    await expect(page.locator("html")).toHaveAttribute("lang", expected);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(dictionaries[expected].docs.title);
    await context.close();
  });
}

test("a ?lang= deep link wins over the browser language", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ locale: "ja-JP" });
  const page = await context.newPage();
  await page.goto(`${baseURL}/docs?lang=ko#helpers`);
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.locator("#helpers h2")).toHaveText(ko.docs.helpers.title);
  // English chosen against a Japanese browser keeps ?lang=en on internal links.
  await page.getByLabel("언어 (Language)", { exact: true }).selectOption("en");
  await expect(page.getByRole("navigation", { name: en.common.primaryNavigation }).getByRole("link", { name: "Marks" }))
    .toHaveAttribute("href", "/marks?lang=en");
  await context.close();
});

test("a slow earlier language load cannot override a later choice", async ({ page }) => {
  const errors = trackErrors(page);
  // Hold the Japanese dictionary so Korean arrives first.
  let releaseJa: () => void = () => {};
  const jaHeld = new Promise<void>((resolve) => { releaseJa = resolve; });
  await page.route(/\/src\/i18n\/ja\.ts/, async (route) => { await jaHeld; await route.continue(); });
  await page.goto("/docs");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const switcher = page.getByLabel(en.common.language, { exact: true });
  await switcher.selectOption("ja");
  await switcher.selectOption("ko");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  releaseJa();
  await page.waitForResponse(/\/src\/i18n\/ja\.ts/);
  await page.waitForTimeout(300);
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(ko.docs.title);
  await expect(page).toHaveURL(/\/docs\?lang=ko$/);
  expect(await page.evaluate(() => window.localStorage.getItem("proofmarks.site.lang"))).toBe("ko");
  expect(errors).toEqual([]);
});
