import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright scaffolding for Phase 1 (per ROADMAP.md). Real end-to-end
 * coverage lands from Phase 2 onward once there are real screens to test;
 * this config + smoke spec only proves the toolchain is wired correctly.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
