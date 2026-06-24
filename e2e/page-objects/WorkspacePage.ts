/**
 * Page Object for the main Workspace.
 */

import { type Page, expect } from "@playwright/test";
import { SEL } from "../helpers/selectors";

export class WorkspacePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/");
    await expect(this.page.locator(SEL.workspace)).toBeVisible({
      timeout: 15_000,
    });
  }

  // ── Request Builder ──

  async selectMethod(method: string) {
    await this.page.locator(SEL.methodSelect).selectOption(method);
  }

  async fillUrl(url: string) {
    await this.page.locator(SEL.urlInput).fill(url);
  }

  async clickSend() {
    await this.page.locator(SEL.sendButton).click();
  }

  async sendAndWaitForResponse() {
    await this.clickSend();
    // Wait for either a response status badge or an error
    await expect(
      this.page
        .locator(SEL.responseStatus)
        .or(this.page.locator(SEL.responseError)),
    ).toBeVisible({ timeout: 35_000 });
  }

  async switchToTab(tab: "params" | "headers" | "body" | "auth") {
    const selMap = {
      params: SEL.tabParams,
      headers: SEL.tabHeaders,
      body: SEL.tabBody,
      auth: SEL.tabAuth,
    };
    await this.page.locator(selMap[tab]).click();
  }

  // ── Assertions ──

  async expectStatus(status: number) {
    await expect(this.page.locator(SEL.responseStatus)).toContainText(
      String(status),
    );
  }

  async expectResponseBodyContains(text: string) {
    await expect(this.page.locator(SEL.responseBody)).toContainText(text);
  }

  async expectEmptyState() {
    await expect(this.page.locator(SEL.responseEmpty)).toBeVisible();
  }

  async expectToast(pattern: RegExp) {
    // Wait for any toast to appear matching the pattern
    const toastContainer = this.page.locator(SEL.toastContainer);
    await expect(toastContainer).toContainText(pattern, { timeout: 10_000 });
  }

  // ── Curl Panel ──

  /**
   * Read the raw curl string from a hidden element that mirrors React state.
   * This avoids Monaco editor rendering artifacts (non-breaking spaces,
   * token splitting across spans, etc.).
   */
  async getCurlText(): Promise<string> {
    const curlText = this.page.locator('[data-testid="curl-text"]');
    await expect(curlText).toContainText("curl", { timeout: 10_000 });
    return (await curlText.textContent()) ?? "";
  }

  // ── Sidebar ──

  async saveRequest(name: string) {
    await this.page.locator(SEL.saveCurrentButton).click();
    await this.page.locator(SEL.saveNameInput).fill(name);
    await this.page.locator(SEL.saveConfirmButton).click();
  }

  async newRequest() {
    await this.page.locator(SEL.newRequestButton).click();
  }
}
