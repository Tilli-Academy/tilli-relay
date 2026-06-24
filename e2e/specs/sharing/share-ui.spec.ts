/**
 * Share dialog UI tests.
 * Tests the share dialog opened from sidebar request actions.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { uniqueRequestName } from "../../helpers/test-data";

test.describe("Share Dialog — UI", () => {
  let ws: WorkspacePage;
  let requestId: string;

  test.beforeEach(async ({ page, api }) => {
    ws = new WorkspacePage(page);
    const name = uniqueRequestName("ShareUI");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");
    requestId = req.id;
    await ws.goto();
  });

  test.afterEach(async ({ api }) => {
    if (requestId) {
      await api.deleteRequest(requestId).catch(() => {});
    }
  });

  test("opens share dialog from sidebar request", async ({ page }) => {
    // Hover over the request to reveal share button
    const requestItem = page.locator(SEL.requestItem(requestId));
    await requestItem.hover();
    const shareButton = page.locator(SEL.requestShare(requestId));
    await expect(shareButton).toBeVisible({ timeout: 5_000 });
    await shareButton.click();

    // Share dialog should appear
    await expect(page.locator('[data-testid="share-dialog"]')).toBeVisible({ timeout: 5_000 });
  });

  test("creates share link via dialog", async ({ page }) => {
    const requestItem = page.locator(SEL.requestItem(requestId));
    await requestItem.hover();
    await page.locator(SEL.requestShare(requestId)).click();

    await expect(page.locator('[data-testid="share-dialog"]')).toBeVisible({ timeout: 5_000 });

    // Click create link
    await page.locator('[data-testid="share-create-link"]').click();

    // Should show success toast
    await ws.expectToast(/link|created|copied/i);
  });

  test("revokes share link via dialog", async ({ page, api }) => {
    // Create a link via API first
    const res = await api.createShareLink(requestId);
    const { token } = await res.json();

    // Open dialog
    const requestItem = page.locator(SEL.requestItem(requestId));
    await requestItem.hover();
    await page.locator(SEL.requestShare(requestId)).click();
    await expect(page.locator('[data-testid="share-dialog"]')).toBeVisible({ timeout: 5_000 });

    // Should see the link — click revoke
    const revokeButton = page.locator('[data-testid="share-link-revoke-0"]');
    await expect(revokeButton).toBeVisible({ timeout: 5_000 });
    await revokeButton.click();

    // Should show toast
    await ws.expectToast(/revoked|deleted|removed/i);

    // Verify link is gone from public access
    const resolveRes = await api.resolveShareLink(token);
    expect(resolveRes.status()).toBe(404);
  });

  test("share dialog shows no links for new request", async ({ page, api }) => {
    // Create a fresh request with no links
    const name = uniqueRequestName("NoLinks");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");

    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });

    const requestItem = page.locator(SEL.requestItem(req.id));
    await requestItem.hover();
    await page.locator(SEL.requestShare(req.id)).click();
    await expect(page.locator('[data-testid="share-dialog"]')).toBeVisible({ timeout: 5_000 });

    await expect(page.locator('[data-testid="share-no-links"]')).toBeVisible();

    await api.deleteRequest(req.id);
  });

  test("share dialog closes on backdrop click", async ({ page }) => {
    const requestItem = page.locator(SEL.requestItem(requestId));
    await requestItem.hover();
    await page.locator(SEL.requestShare(requestId)).click();

    const dialog = page.locator('[data-testid="share-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Click the backdrop
    await page.locator('[data-testid="share-dialog-backdrop"]').click({ position: { x: 10, y: 10 } });
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });

  test("share dialog closes on Escape key", async ({ page }) => {
    const requestItem = page.locator(SEL.requestItem(requestId));
    await requestItem.hover();
    await page.locator(SEL.requestShare(requestId)).click();

    const dialog = page.locator('[data-testid="share-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });
});
