/**
 * Page Object for the Login / Signup page.
 */

import { type Page, expect } from "@playwright/test";
import { SEL } from "../helpers/selectors";

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/login");
    await this.page.waitForLoadState("load");
  }

  async login(email: string, password: string) {
    // Switch to login mode if signup form is visible
    const loginToggle = this.page.locator(SEL.authModeLogin);
    if (await loginToggle.isVisible().catch(() => false)) {
      await loginToggle.click();
    }
    await this.page.locator(SEL.loginEmail).fill(email);
    await this.page.locator(SEL.loginPassword).fill(password);
    await this.page.locator(SEL.loginSubmit).click();
  }

  async signup(email: string, password: string, confirmPassword?: string) {
    // Switch to signup mode
    const signupToggle = this.page.locator(SEL.authModeSignup);
    if (await signupToggle.isVisible().catch(() => false)) {
      await signupToggle.click();
    }
    await this.page.locator(SEL.signupEmail).fill(email);
    await this.page.locator(SEL.signupPassword).fill(password);
    const confirmField = this.page.locator(SEL.signupConfirmPassword);
    if (await confirmField.isVisible().catch(() => false)) {
      await confirmField.fill(confirmPassword ?? password);
    }
    await this.page.locator(SEL.signupSubmit).click();
  }

  async expectLoginError(pattern: RegExp) {
    await expect(this.page.locator(SEL.loginError)).toBeVisible({
      timeout: 10_000,
    });
    await expect(this.page.locator(SEL.loginError)).toContainText(pattern);
  }

  async expectSignupError(pattern: RegExp) {
    await expect(this.page.locator(SEL.signupError)).toBeVisible({
      timeout: 10_000,
    });
    await expect(this.page.locator(SEL.signupError)).toContainText(pattern);
  }

  async expectRedirectToWorkspace() {
    await this.page.waitForURL(/^(?!.*\/login)/, { timeout: 15_000 });
    await expect(this.page.locator(SEL.workspace)).toBeVisible({
      timeout: 15_000,
    });
  }
}
