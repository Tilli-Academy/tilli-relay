import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("Response Headers Display", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("shows headers tab with count badge after response", async ({
    page,
  }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await expect(page.locator(SEL.responseTabHeaders)).toContainText(
      /Headers\s*\d+/,
    );
  });

  test("displays all response header key-value pairs", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await page.locator(SEL.responseTabHeaders).click();
    await expect(page.locator(SEL.responseHeadersTable)).toBeVisible();
    await expect(page.locator(SEL.responseHeadersTable)).toContainText(
      /content-type/i,
    );
    await expect(page.locator(SEL.responseHeadersTable)).toContainText(
      /application\/json/i,
    );
  });

  test("can switch between body and headers tabs", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await page.locator(SEL.responseTabHeaders).click();
    await expect(page.locator(SEL.responseHeadersTable)).toBeVisible();
    await page.locator(SEL.responseTabBody).click();
    await expect(page.locator(SEL.responseBody)).toBeVisible();
  });
});
