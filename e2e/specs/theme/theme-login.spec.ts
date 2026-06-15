import { test as base, expect } from "@playwright/test";

const test = base;

/**
 * Tests that the login page also respects theme settings.
 * Login page tests don't use auth fixtures since they test the unauthenticated state.
 */
test.describe("Login Page Theme Support", () => {
  test("login page uses semantic theme classes", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // The login page should use bg-surface-base instead of hardcoded bg-black
    // Verify by checking the computed background color changes when we toggle theme
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Check that the page renders with the default dark theme colors
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--surface-base").trim();
    });
    // Default should be dark
    expect(bgColor).toBe("#09090b");
  });

  test("login page responds to light theme from localStorage", async ({ page }) => {
    // Set light theme in localStorage before navigating
    await page.goto("/login");
    await page.evaluate(() => localStorage.setItem("relay-theme", "light"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);

    // html should have .light class
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass).toContain("light");

    // Verify CSS vars are light theme
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--surface-base").trim();
    });
    expect(bgColor).toBe("#f0f1f3");
  });

  test("login form inputs are visible in light theme", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => localStorage.setItem("relay-theme", "light"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);

    // Login email and password inputs should be visible
    const emailInput = page.locator('[data-testid="login-email"]');
    const passwordInput = page.locator('[data-testid="login-password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("login form inputs are visible in dark theme", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => localStorage.setItem("relay-theme", "dark"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);

    const emailInput = page.locator('[data-testid="login-email"]');
    const passwordInput = page.locator('[data-testid="login-password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });
});
