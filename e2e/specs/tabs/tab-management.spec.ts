import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";

test.describe("Tab Management", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("starts with one default tab", async ({ page }) => {
    await expect(page.locator(SEL.tabBar)).toBeVisible();
    const tabs = page.locator(SEL.tabItems);
    await expect(tabs.first()).toBeVisible();
  });

  test("New Request button creates a new tab", async ({ page }) => {
    await ws.newRequest();
    const tabs = page.locator(SEL.tabItems);
    await expect(tabs).toHaveCount(2);
  });

  test("+ button in tab bar creates a new tab", async ({ page }) => {
    await page.locator(SEL.newTabButton).click();
    const tabs = page.locator(SEL.tabItems);
    await expect(tabs).toHaveCount(2);
  });

  test("switching between tabs preserves independent state", async ({
    page,
  }) => {
    await ws.selectMethod("POST");
    await ws.fillUrl("https://httpbin.org/post");
    await ws.newRequest();
    await expect(page.locator(SEL.methodSelect)).toHaveValue("GET");
    await expect(page.locator(SEL.urlInput)).toHaveValue("");
    const firstTab = page.locator(SEL.tabItems).first();
    await firstTab.click();
    await expect(page.locator(SEL.methodSelect)).toHaveValue("POST");
    await expect(page.locator(SEL.urlInput)).toHaveValue(
      "https://httpbin.org/post",
    );
  });

  test("closes a tab when multiple tabs exist", async ({ page }) => {
    await ws.newRequest();
    const tabs = page.locator(SEL.tabItems);
    await expect(tabs).toHaveCount(2);
    const secondTab = tabs.nth(1);
    await secondTab.hover();
    const closeButton = secondTab.locator('[data-testid^="tab-close-"]');
    await closeButton.click();
    await expect(tabs).toHaveCount(1);
  });

  test("cannot close the last remaining tab", async ({ page }) => {
    const tabs = page.locator(SEL.tabItems);
    await expect(tabs).toHaveCount(1);
    await tabs.first().hover();
    const closeButton = tabs
      .first()
      .locator('[data-testid^="tab-close-"]');
    await expect(closeButton).not.toBeVisible();
  });

  test("tab state persists method and URL independently across many tabs", async ({
    page,
  }) => {
    // Create 3 tabs with different methods/URLs
    await ws.selectMethod("POST");
    await ws.fillUrl("https://httpbin.org/post");

    await ws.newRequest();
    await ws.selectMethod("PUT");
    await ws.fillUrl("https://httpbin.org/put");

    await ws.newRequest();
    await ws.selectMethod("DELETE");
    await ws.fillUrl("https://httpbin.org/delete");

    // Switch to first tab — should be POST
    const tabs = page.locator(SEL.tabItems);
    await tabs.nth(0).click();
    await expect(page.locator(SEL.methodSelect)).toHaveValue("POST");
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://httpbin.org/post");

    // Switch to second tab — should be PUT
    await tabs.nth(1).click();
    await expect(page.locator(SEL.methodSelect)).toHaveValue("PUT");
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://httpbin.org/put");

    // Switch to third tab — should be DELETE
    await tabs.nth(2).click();
    await expect(page.locator(SEL.methodSelect)).toHaveValue("DELETE");
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://httpbin.org/delete");
  });

  test("closing a tab in the middle preserves other tabs", async ({
    page,
  }) => {
    // Tab 1: GET /get
    await ws.fillUrl("https://httpbin.org/get");

    // Tab 2: POST /post
    await ws.newRequest();
    await ws.selectMethod("POST");
    await ws.fillUrl("https://httpbin.org/post");

    // Tab 3: PUT /put
    await ws.newRequest();
    await ws.selectMethod("PUT");
    await ws.fillUrl("https://httpbin.org/put");

    const tabs = page.locator(SEL.tabItems);
    await expect(tabs).toHaveCount(3);

    // Close the middle tab (index 1)
    const middleTab = tabs.nth(1);
    await middleTab.hover();
    const closeButton = middleTab.locator('[data-testid^="tab-close-"]');
    await closeButton.click();

    await expect(tabs).toHaveCount(2);

    // First tab should still be GET
    await tabs.nth(0).click();
    await expect(page.locator(SEL.methodSelect)).toHaveValue("GET");
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://httpbin.org/get");

    // Second tab (was third) should still be PUT
    await tabs.nth(1).click();
    await expect(page.locator(SEL.methodSelect)).toHaveValue("PUT");
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://httpbin.org/put");
  });
});
