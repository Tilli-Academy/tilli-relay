/**
 * Shared page tests: public /shared/:token page rendering.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { uniqueRequestName } from "../../helpers/test-data";

test.describe("Shared Page (/shared/:token)", () => {
  test("renders request name and curl command", async ({ api, page }) => {
    const name = uniqueRequestName("SharedPage");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");
    const res = await api.createShareLink(req.id);
    const { token } = await res.json();

    try {
      await page.goto(`/shared/${token}`);
      // Should display the request name
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
      // Should display the curl command somewhere on the page
      await expect(page.locator("text=curl").first()).toBeVisible();
      await expect(page.locator("text=httpbin.org").first()).toBeVisible();
    } finally {
      await api.revokeShareLink(token);
      await api.deleteRequest(req.id);
    }
  });

  test("shows method badge and URL", async ({ api, page }) => {
    const name = uniqueRequestName("SharedPage");
    const req = await api.createRequest(name, "curl -X POST https://httpbin.org/post");
    const res = await api.createShareLink(req.id);
    const { token } = await res.json();

    try {
      await page.goto(`/shared/${token}`);
      await expect(page.locator("text=POST").first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("text=httpbin.org/post").first()).toBeVisible();
    } finally {
      await api.revokeShareLink(token);
      await api.deleteRequest(req.id);
    }
  });

  test("copy button exists and is clickable", async ({ api, page }) => {
    const name = uniqueRequestName("SharedPage");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");
    const res = await api.createShareLink(req.id);
    const { token } = await res.json();

    try {
      await page.goto(`/shared/${token}`);
      // Look for a copy button
      const copyButton = page.getByRole("button", { name: /copy/i });
      await expect(copyButton).toBeVisible({ timeout: 10_000 });
    } finally {
      await api.revokeShareLink(token);
      await api.deleteRequest(req.id);
    }
  });

  test("invalid token shows not found message", async ({ page }) => {
    await page.goto("/shared/invalid-token-that-does-not-exist");
    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 10_000 });
  });

  test("expired share link shows expired message", async ({ api, page }) => {
    const name = uniqueRequestName("SharedPage");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");
    // Create with very short expiration (0.001 hours = ~3.6 seconds)
    const res = await api.createShareLink(req.id, 0.001);
    const { token } = await res.json();

    try {
      // Wait for expiration
      await page.waitForTimeout(5000);
      await page.goto(`/shared/${token}`);
      // Should show expired or not found
      await expect(
        page.getByText(/expired/i).first().or(page.getByText(/not found/i).first())
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await api.revokeShareLink(token).catch(() => {});
      await api.deleteRequest(req.id);
    }
  });
});
