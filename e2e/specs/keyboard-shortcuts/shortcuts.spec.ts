import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("Keyboard Shortcuts", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("Ctrl+S opens save prompt", async ({ page }) => {
    await page.keyboard.press("Control+s");
    await expect(page.locator(SEL.saveNameInput)).toBeVisible();
  });

  test("Ctrl+Shift+L focuses URL input", async ({ page }) => {
    // Click body first to ensure Monaco doesn't intercept the shortcut
    await page.locator(SEL.workspace).click();
    await page.keyboard.press("Control+Shift+l");
    await expect(page.locator(SEL.urlInput)).toBeFocused();
  });

  test("Ctrl+K opens search overlay", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.locator(SEL.searchOverlay)).toBeVisible();
  });

  test("Ctrl+Shift+E opens environment panel", async ({ page }) => {
    // Click body first to ensure Monaco doesn't intercept the shortcut
    await page.locator(SEL.workspace).click();
    await page.keyboard.press("Control+Shift+e");
    await expect(page.locator(SEL.envPanel)).toBeVisible();
  });

  test("Escape closes search overlay", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.locator(SEL.searchOverlay)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(SEL.searchOverlay)).not.toBeVisible();
  });

  test("Ctrl+Enter sends the current request", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await page.locator(SEL.urlInput).focus();
    await page.keyboard.press("Control+Enter");
    await expect(page.locator(SEL.responseStatus)).toBeVisible({
      timeout: 35_000,
    });
  });
});
