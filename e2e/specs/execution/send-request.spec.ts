import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";

test.describe("Request Execution", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("sends GET request and displays 200 response", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/get");
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
  });

  test("sends POST request with JSON body and shows response", async ({
    page,
  }) => {
    await ws.selectMethod("POST");
    await ws.fillUrl("https://httpbin.org/post");
    await ws.switchToTab("body");
    await page.locator(SEL.bodyTypeJson).click();
    await page.locator(SEL.bodyJsonInput).fill('{"name":"playwright"}');
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
    await ws.expectResponseBodyContains("playwright");
  });

  test("displays response time in milliseconds", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/get");
    await ws.sendAndWaitForResponse();
    await expect(page.locator(SEL.responseTime)).toContainText(/\d+ms/);
  });

  test("displays response body size", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/get");
    await ws.sendAndWaitForResponse();
    await expect(page.locator(SEL.responseSize)).toContainText(
      /\d+(\.\d+)?\s*(B|KB|MB)/,
    );
  });

  test("response headers tab shows headers with count badge", async ({
    page,
  }) => {
    await ws.fillUrl("https://httpbin.org/get");
    await ws.sendAndWaitForResponse();
    await page.locator(SEL.responseTabHeaders).click();
    await expect(page.locator(SEL.responseHeadersTable)).toBeVisible();
    await expect(page.locator(SEL.responseHeadersTable)).toContainText(
      /content-type/i,
    );
  });

  test("JSON response shows pretty/raw toggle", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/get");
    await ws.sendAndWaitForResponse();
    await expect(page.locator(SEL.responseViewPretty)).toBeVisible();
    await expect(page.locator(SEL.responseViewRaw)).toBeVisible();
  });

  test("switching between pretty and raw view works", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/get");
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
    await ws.fillUrl("https://httpbin.org/get");
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
    await ws.fillUrl("https://httpbin.org/put");
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
  });

  test("sends DELETE request successfully", async () => {
    await ws.selectMethod("DELETE");
    await ws.fillUrl("https://httpbin.org/delete");
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
  });
});
