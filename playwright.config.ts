import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PROOFMARKS_TEST_PORT ?? 4173);

export default defineConfig({
  testDir: "./tests",
  testIgnore: "pages.spec.ts",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm --filter @proofmarks/playground exec vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: /release-matrix\.spec\.ts/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: /release-matrix\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
