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
});
