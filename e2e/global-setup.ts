/**
 * Playwright global setup.
 * Creates test user accounts (one per worker) and saves storageState files.
 */

import { chromium, type FullConfig } from "@playwright/test";
import path from "path";
import fs from "fs";
import Redis from "ioredis";
import { startMockServer } from "./mock-server";

const WORKER_COUNT = 4;
const TEST_PASSWORD = "TestP@ss1234!";

function testEmail(workerIndex: number): string {
  return `e2e-worker-${workerIndex}@test.relay.local`;
}

function authDir(): string {
  return path.resolve(__dirname, ".auth");
}

function storageStatePath(workerIndex: number): string {
  return path.join(authDir(), `worker-${workerIndex}.json`);
}

export default async function globalSetup(config: FullConfig) {
  // Start the mock HTTP server (replaces httpbin.org for reliable tests)
  await startMockServer();

  const baseURL =
    config.projects[0]?.use?.baseURL || "http://localhost:3002";

  // Ensure auth directory exists
  fs.mkdirSync(authDir(), { recursive: true });

  const browser = await chromium.launch();

  for (let i = 0; i < WORKER_COUNT; i++) {
    const email = testEmail(i);
    const storagePath = storageStatePath(i);

    // Skip if storageState is fresh AND the session is still valid in Redis
    if (fs.existsSync(storagePath)) {
      const stat = fs.statSync(storagePath);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs < 60 * 60 * 1000) {
        // Validate by hitting /api/auth/me with the stored session cookie
        const testCtx = await browser.newContext({ storageState: storagePath });
        const response = await testCtx.request.get(`${baseURL}/api/auth/me`);
        await testCtx.close();
        if (response.ok()) {
          console.log(`  [global-setup] Reusing storageState for worker-${i}`);
          continue;
        }
        console.log(`  [global-setup] Session expired for worker-${i}, re-creating...`);
      }
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Try to sign up first (idempotent — will fail if user exists)
      await page.goto(`${baseURL}/login?mode=signup`);
      await page.waitForLoadState("networkidle");

      // Check if we're on signup mode
      const signupEmail = page.locator('[data-testid="signup-email"]');
      if (await signupEmail.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await signupEmail.fill(email);
        await page.locator('[data-testid="signup-password"]').fill(TEST_PASSWORD);
        const confirmField = page.locator('[data-testid="signup-confirm-password"]');
        if (await confirmField.isVisible().catch(() => false)) {
          await confirmField.fill(TEST_PASSWORD);
        }
        await page.locator('[data-testid="signup-submit"]').click();

        // Wait for redirect to workspace or error
        try {
          await page.waitForURL(/^(?!.*\/login)/, { timeout: 10_000 });
          console.log(`  [global-setup] Created user: ${email}`);
        } catch {
          // User may already exist — try login instead
          console.log(`  [global-setup] Signup failed for ${email}, trying login...`);
        }
      }

      // If we're still on login, do login
      if (page.url().includes("/login")) {
        // Switch to login mode if needed
        const loginToggle = page.locator('[data-testid="auth-mode-login"]');
        if (await loginToggle.isVisible().catch(() => false)) {
          await loginToggle.click();
        }
        await page.locator('[data-testid="login-email"]').fill(email);
        await page.locator('[data-testid="login-password"]').fill(TEST_PASSWORD);
        await page.locator('[data-testid="login-submit"]').click();
        await page.waitForURL(/^(?!.*\/login)/, { timeout: 10_000 });
        console.log(`  [global-setup] Logged in user: ${email}`);
      }

      // Save storageState
      await context.storageState({ path: storagePath });
      console.log(`  [global-setup] Saved storageState: worker-${i}`);
    } catch (err) {
      console.error(`  [global-setup] Failed to setup worker-${i}:`, err);
    } finally {
      await context.close();
    }
  }

  await browser.close();

  // Flush rate-limit keys so login tests don't get throttled
  try {
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const keys = await redis.keys("ratelimit:login:*");
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
    console.log(`  [global-setup] Cleared ${keys.length} rate-limit keys`);
  } catch (err) {
    console.warn("  [global-setup] Failed to clear rate-limit keys:", err);
  }
}
