import { defineConfig, devices } from "@playwright/test";
import path from "path";

const PORT = process.env.PORT || 3002;
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e/specs",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["list"],
    ...(process.env.CI ? ([["github"]] as const) : []),
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  globalSetup: path.resolve(__dirname, "e2e/global-setup.ts"),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    port: Number(PORT),
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { NODE_ENV: "test" },
  },
});
