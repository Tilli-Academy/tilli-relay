import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";

test.describe("Session Management", () => {
  test("maintains session across page reloads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
  });

  test("shows user email in sidebar", async ({ page, testUser }) => {
    await page.goto("/");
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SEL.sidebarUserEmail)).toContainText(
      testUser.email,
    );
  });

  test("logs out and redirects to login page", async ({
    browser,
    baseURL,
    testUser,
  }) => {
    // Create a FRESH login session so we don't destroy the shared storageState session
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${baseURL}/login`);
    await page.locator(SEL.loginEmail).fill(testUser.email);
    await page.locator(SEL.loginPassword).fill(testUser.password);
    await page.locator(SEL.loginSubmit).click();
    await page.waitForURL(/^(?!.*\/login)/, { timeout: 15_000 });
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });

    await page.locator(SEL.sidebarLogout).click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page.locator(SEL.loginEmail)).toBeVisible();
    await ctx.close();
  });

  test("unauthenticated request to API returns 401", async ({
    baseURL,
  }) => {
    // Use native fetch with no cookies to guarantee an unauthenticated request
    const response = await fetch(`${baseURL}/api/requests`);
    expect(response.status).toBe(401);
  });
});
