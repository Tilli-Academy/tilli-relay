/**
 * History UI tests: history tab display in response viewer.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("History — UI", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page, api }) => {
    ws = new WorkspacePage(page);
    await api.clearHistory();
    await ws.goto();
  });

  test("history tab appears after first execution", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);

    // History tab should now be visible
    const historyTab = page.locator(SEL.responseTabHistory);
    await expect(historyTab).toBeVisible({ timeout: 5_000 });
  });

  test("history entries show in reverse chronological order", async ({ page }) => {
    // Execute GET first, then POST
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();

    await ws.selectMethod("POST");
    await ws.fillUrl(`${MOCK_BASE}/post`);
    await ws.sendAndWaitForResponse();

    // Open history tab
    await page.locator(SEL.responseTabHistory).click();

    // First entry (index 0) should be the most recent (POST)
    const firstEntry = page.locator('[data-testid="history-entry-0"]');
    await expect(firstEntry).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="history-entry-method-0"]')).toContainText("POST");
  });

  test("history entry shows method, URL, status code", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();

    await page.locator(SEL.responseTabHistory).click();

    const entry = page.locator('[data-testid="history-entry-0"]');
    await expect(entry).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="history-entry-method-0"]')).toContainText("GET");
    await expect(page.locator('[data-testid="history-entry-url-0"]')).toContainText("localhost:9444");
    await expect(page.locator('[data-testid="history-entry-status-0"]')).toContainText("200");
  });

  test("clicking history entry loads its response", async ({ page }) => {
    // Execute a GET request
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);

    // Execute a different request to change current response
    await ws.selectMethod("POST");
    await ws.fillUrl(`${MOCK_BASE}/post`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);

    // Open history tab and click the GET entry (should be second/index 1)
    await page.locator(SEL.responseTabHistory).click();
    const getEntry = page.locator('[data-testid="history-entry-1"]');
    await expect(getEntry).toBeVisible({ timeout: 5_000 });
    await getEntry.click();

    // Response should now show the GET response
    await page.locator(SEL.responseTabBody).click();
    await ws.expectResponseBodyContains("localhost:9444/get");
  });

  test("clear history empties the list", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();

    await page.locator(SEL.responseTabHistory).click();
    await expect(page.locator('[data-testid="history-entry-0"]')).toBeVisible({ timeout: 5_000 });

    // Click clear button
    await page.locator('[data-testid="history-clear-button"]').click();

    // Should show empty state
    await expect(page.locator('[data-testid="history-empty"]')).toBeVisible({ timeout: 5_000 });
  });

  test("history persists across page reloads", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();

    // Wait for history to persist to DB
    await page.waitForTimeout(1500);

    // Reload
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });

    // Execute again to make history tab appear (it only shows if history.length > 0)
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();

    await page.locator(SEL.responseTabHistory).click();
    // Should have at least 2 entries (the pre-reload one + the new one)
    await expect(page.locator('[data-testid="history-entry-0"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="history-entry-1"]')).toBeVisible({ timeout: 5_000 });
  });

  test("sending multiple requests accumulates history entries", async ({ page }) => {
    // Send 3 requests
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();

    await ws.selectMethod("POST");
    await ws.fillUrl(`${MOCK_BASE}/post`);
    await ws.sendAndWaitForResponse();

    await ws.selectMethod("PUT");
    await ws.fillUrl(`${MOCK_BASE}/put`);
    await ws.sendAndWaitForResponse();

    await page.locator(SEL.responseTabHistory).click();

    // Should have at least 3 entries
    await expect(page.locator('[data-testid="history-entry-0"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="history-entry-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="history-entry-2"]')).toBeVisible();
  });
});
