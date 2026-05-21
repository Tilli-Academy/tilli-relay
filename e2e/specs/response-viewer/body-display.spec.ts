import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";

test.describe("Response Body Display", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("shows empty state before any request", async ({ page }) => {
    await expect(page.locator(SEL.responseEmpty)).toBeVisible();
    await expect(page.locator(SEL.responseEmpty)).toContainText(
      "Send a request to see the response",
    );
  });

  test("shows JSON tree viewer in pretty mode", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/get");
    await ws.sendAndWaitForResponse();
    await expect(page.locator(SEL.responseViewPretty)).toBeVisible();
    await expect(page.locator(SEL.responseBody)).toBeVisible();
  });

  test("shows raw text in raw mode", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/get");
    await ws.sendAndWaitForResponse();
    await page.locator(SEL.responseViewRaw).click();
    await expect(page.locator(SEL.responseBody)).toBeVisible();
    await expect(page.locator(SEL.responseBody).locator("pre")).toBeVisible();
  });

  test("displays non-JSON text responses", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/html");
    await ws.sendAndWaitForResponse();
    await expect(page.locator(SEL.responseBody)).toBeVisible();
  });

  test("shows response size indicator", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/get");
    await ws.sendAndWaitForResponse();
    await expect(page.locator(SEL.responseSize)).toBeVisible();
  });
});
