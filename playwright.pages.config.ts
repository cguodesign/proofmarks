import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PROOFMARKS_PAGES_TEST_PORT ?? 4175);
export default defineConfig({
  testDir: "./tests",
  testMatch: "pages.spec.ts",
  use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${port}`, locale: "en-US" },
  webServer: {
    command: "node scripts/serve-pages.mjs",
    url: `http://127.0.0.1:${port}${process.env.PROOFMARKS_SITE_BASE ?? "/proofmarks/"}`,
    reuseExistingServer: false,
  },
});
