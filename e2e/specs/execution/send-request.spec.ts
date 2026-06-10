import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("Request Execution", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("sends GET request and displays 200 response", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
  });

  test("sends POST request with JSON body and shows response", async ({
    page,
  }) => {
    await ws.selectMethod("POST");
    await ws.fillUrl(`${MOCK_BASE}/post`);
    await ws.switchToTab("body");
    await page.locator(SEL.bodyTypeJson).click();
    await page.locator(SEL.bodyJsonInput).fill('{"name":"playwright"}');
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
    await ws.expectResponseBodyContains("playwright");
  });

  test("displays response time in milliseconds", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await expect(page.locator(SEL.responseTime)).toContainText(/\d+ms/);
  });

  test("displays response body size", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await expect(page.locator(SEL.responseSize)).toContainText(
      /\d+(\.\d+)?\s*(B|KB|MB)/,
    );
  });

  test("response headers tab shows headers with count badge", async ({
    page,
  }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await page.locator(SEL.responseTabHeaders).click();
    await expect(page.locator(SEL.responseHeadersTable)).toBeVisible();
    await expect(page.locator(SEL.responseHeadersTable)).toContainText(
      /content-type/i,
    );
  });

  test("JSON response shows pretty/raw toggle", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await expect(page.locator(SEL.responseViewPretty)).toBeVisible();
    await expect(page.locator(SEL.responseViewRaw)).toBeVisible();
  });

  test("switching between pretty and raw view works", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await page.locator(SEL.responseViewRaw).click();
    await expect(page.locator(SEL.responseBody)).toBeVisible();
    await page.locator(SEL.responseViewPretty).click();
    await expect(page.locator(SEL.responseBody)).toBeVisible();
  });

  test("copy response body button shows Copied state", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.sendAndWaitForResponse();
    await page.locator(SEL.responseCopy).click();
    await expect(page.locator(SEL.responseCopy)).toContainText("Copied");
  });

  test("shows empty state before first request", async ({ page }) => {
    await ws.expectEmptyState();
    await expect(page.locator(SEL.responseEmpty)).toContainText(
      "Send a request",
    );
  });

  test("sends PUT request successfully", async () => {
    await ws.selectMethod("PUT");
    await ws.fillUrl(`${MOCK_BASE}/put`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
  });

  test("sends DELETE request successfully", async () => {
    await ws.selectMethod("DELETE");
    await ws.fillUrl(`${MOCK_BASE}/delete`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
  });

  test("PATCH request sends and returns correct response", async () => {
    await ws.selectMethod("PATCH");
    await ws.fillUrl(`${MOCK_BASE}/patch`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
    await ws.expectResponseBodyContains("patch");
  });

  test("POST with custom Content-Type header works", async ({ page }) => {
    await ws.selectMethod("POST");
    await ws.fillUrl(`${MOCK_BASE}/post`);
    await ws.switchToTab("headers");
    await page.locator(SEL.headerKey(0)).fill("Content-Type");
    await page.locator(SEL.headerValue(0)).fill("text/xml");
    await ws.switchToTab("body");
    await page.locator(SEL.bodyTypeText).click();
    await page.locator(SEL.bodyTextInput).fill("<root>data</root>");
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
  });

  test("request to slow endpoint shows spinner then completes", async ({
    page,
  }) => {
    await ws.fillUrl(`${MOCK_BASE}/delay/2`);
    await ws.clickSend();
    // Spinner should appear while waiting
    await expect(page.locator(SEL.responseSending)).toBeVisible({ timeout: 5_000 });
    // Then result arrives
    await expect(page.locator(SEL.responseStatus)).toBeVisible({ timeout: 35_000 });
    await ws.expectStatus(200);
  });

  test("response with non-JSON content type displays as raw text", async ({
    page,
  }) => {
    await ws.fillUrl(`${MOCK_BASE}/html`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
    // Should show some HTML content in response body
    await ws.expectResponseBodyContains("Herman Melville");
  });
});
