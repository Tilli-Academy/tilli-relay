import { test as base, expect } from "@playwright/test";
import { SEL } from "../../helpers/selectors";
import { LoginPage } from "../../page-objects/LoginPage";
import { uniqueId } from "../../helpers/test-data";

const test = base;

test.describe("Signup Flow", () => {
  test("shows password strength indicator as user types", async ({ page }) => {
    await page.goto("/login?mode=signup");
    await expect(page.locator(SEL.passwordStrength)).not.toBeVisible();
    await page.locator(SEL.signupPassword).fill("a");
    await expect(page.locator(SEL.passwordStrength)).toBeVisible();
  });

  test("shows strong password status when all rules met", async ({ page }) => {
    await page.goto("/login?mode=signup");
    await page.locator(SEL.signupPassword).fill("StrongP@ss1");
    await expect(page.locator(SEL.passwordStrength)).toContainText(
      "Strong password",
    );
  });

  test("shows partial strength for weak password", async ({ page }) => {
    await page.goto("/login?mode=signup");
    await page.locator(SEL.signupPassword).fill("weak");
    await expect(page.locator(SEL.passwordStrength)).toContainText(
      /\d\/5 requirements met/,
    );
  });

  test("shows error for mismatched passwords", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.signup(
      `mismatch-${uniqueId()}@test.local`,
      "StrongP@ss1!",
      "DifferentP@ss2!",
    );
    await loginPage.expectSignupError(/do not match|mismatch/i);
  });

  test("shows error for duplicate email", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.signup(
      "e2e-worker-0@test.relay.local",
      "StrongP@ss1!",
    );
    await loginPage.expectSignupError(/already exists|duplicate|registered/i);
  });

  test("shows error for weak password from server", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.signup(`weak-${uniqueId()}@test.local`, "short");
    await loginPage.expectSignupError(/password|weak|requirements/i);
  });

  test("creates a new account and redirects to workspace", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    const email = `e2e-signup-${uniqueId()}@test.relay.local`;
    await loginPage.signup(email, "StrongP@ss1!");
    await loginPage.expectRedirectToWorkspace();
  });
});
