import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

// These tests assert English site copy; pin the browser language explicitly.
test.use({ locale: "en-US" });

const artifact = (name: string) =>
  path.join(
    process.cwd(),
    "docs",
    "tasks",
    "08302026-task010a-release-hardening",
    "artifacts",
    `task010a-${name}.png`,
  );

async function prepare(page: Page): Promise<void> {
  const skip = page.locator(".skip-link");
  if (await skip.count()) {
    await skip.evaluate((element) => { (element as HTMLElement).style.visibility = "hidden"; });
  }
  const images = page.locator("img");
  if (await images.count()) {
    await images.evaluateAll((nodes) => {
      for (const node of nodes) (node as HTMLImageElement).loading = "eager";
    });
    await expect.poll(async () => images.evaluateAll((nodes) =>
      nodes.every((node) => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0),
    )).toBe(true);
  }
}

test("capture final V0.1 release-candidate surfaces", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/");
  await expect(page.locator(".home-page [data-proofmarks-overlay]")).not.toHaveCount(0);
  await prepare(page);
  await page.screenshot({ path: artifact("homepage"), fullPage: true });

  await page.goto("/get-started");
  await expect(page.locator(".guide-example-result [data-proofmarks-overlay]")).toHaveCount(2);
  await prepare(page);
  await page.locator('[data-example="replace"]').screenshot({ path: artifact("playground") });

  await page.goto("/marks");
  await expect(page.locator(".catalog-table [data-proofmarks-overlay]")).toHaveCount(8);
  await prepare(page);
  await page.locator(".catalog-table").screenshot({ path: artifact("marks-overview") });

  await page.goto("/references");
  await expect(page).toHaveURL(/docs#references$/);
  await prepare(page);
  await page.locator("#references").screenshot({ path: artifact("references") });

  await page.goto("/docs");
  await expect(page.locator("#corrections")).toBeVisible();
  await prepare(page);
  await page.locator("#corrections").screenshot({ path: artifact("docs-quickstart") });
});
