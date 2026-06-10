import { test as base, expect } from "@playwright/test";
import { SEL } from "../../helpers/selectors";
import { LoginPage } from "../../page-objects/LoginPage";
import { uniqueId } from "../../helpers/test-data";

// Use base test (no auth fixture) since we're testing login itself
const test = base;

test.describe("Login Flow", () => {
  test("shows login form by default", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator(SEL.loginEmail)).toBeVisible();
    await expect(page.locator(SEL.loginPassword)).toBeVisible();
    await expect(page.locator(SEL.loginSubmit)).toBeVisible();
  });

  test("switches to signup mode when Sign up toggle is clicked", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator(SEL.authModeSignup).click();
    await expect(page.locator(SEL.signupEmail)).toBeVisible();
    await expect(page.locator(SEL.signupPassword)).toBeVisible();
    await expect(page.locator(SEL.signupConfirmPassword)).toBeVisible();
    await expect(page.locator(SEL.signupSubmit)).toBeVisible();
  });

  test("switches back to login mode when Log in toggle is clicked", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator(SEL.authModeSignup).click();
    await expect(page.locator(SEL.signupEmail)).toBeVisible();
    await page.locator(SEL.authModeLogin).click();
    await expect(page.locator(SEL.loginEmail)).toBeVisible();
  });

  test("opens signup mode when URL has ?mode=signup", async ({ page }) => {
    await page.goto("/login?mode=signup");
    await expect(page.locator(SEL.signupEmail)).toBeVisible();
  });

  test("shows error for empty email and password", async ({ page }) => {
    await page.goto("/login");
    await page.locator(SEL.loginEmail).fill("");
    await page.locator(SEL.loginPassword).fill("");
    await page.locator(SEL.loginSubmit).click();
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows error for wrong password", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("e2e-worker-0@test.relay.local", "WrongP@ssword1!");
    await loginPage.expectLoginError(/incorrect|wrong|invalid/i);
  });

  test("shows error for non-existent email", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      `nonexistent-${uniqueId()}@test.local`,
      "TestP@ss1234!",
    );
    // Server returns the same generic error for both wrong password and non-existent email
    // to prevent user enumeration
    await loginPage.expectLoginError(/invalid email or password|incorrect|wrong/i);
  });

  test("shows loading spinner during login submission", async ({ page }) => {
    await page.goto("/login");
    await page.locator(SEL.loginEmail).fill("e2e-worker-0@test.relay.local");
    await page.locator(SEL.loginPassword).fill("TestP@ss1234!");
    await page.locator(SEL.loginSubmit).click();
    await expect(page.locator(SEL.loginSubmit)).toContainText(/logging in/i);
  });

  test("logs in successfully and redirects to workspace", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("e2e-worker-0@test.relay.local", "TestP@ss1234!");
    await loginPage.expectRedirectToWorkspace();
  });
});
