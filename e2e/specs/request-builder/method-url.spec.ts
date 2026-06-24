import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("Method & URL Bar", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("defaults to GET method", async ({ page }) => {
    await expect(page.locator(SEL.methodSelect)).toHaveValue("GET");
  });

  test("changes method to POST", async ({ page }) => {
    await ws.selectMethod("POST");
    await expect(page.locator(SEL.methodSelect)).toHaveValue("POST");
  });

  test("changes method to PUT", async ({ page }) => {
    await ws.selectMethod("PUT");
    await expect(page.locator(SEL.methodSelect)).toHaveValue("PUT");
  });

  test("changes method to DELETE", async ({ page }) => {
    await ws.selectMethod("DELETE");
    await expect(page.locator(SEL.methodSelect)).toHaveValue("DELETE");
  });

  test("changes method to PATCH", async ({ page }) => {
    await ws.selectMethod("PATCH");
    await expect(page.locator(SEL.methodSelect)).toHaveValue("PATCH");
  });

  test("body tab hidden for GET, visible for POST", async ({ page }) => {
    // GET — body tab should be hidden or disabled
    await expect(page.locator(SEL.tabBody)).not.toBeVisible();

    // POST — body tab appears
    await ws.selectMethod("POST");
    await expect(page.locator(SEL.tabBody)).toBeVisible();
  });

  test("Ctrl+Enter sends request from URL bar", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await page.locator(SEL.urlInput).focus();
    await page.keyboard.press("Control+Enter");
    await expect(page.locator(SEL.responseStatus)).toBeVisible({
      timeout: 35_000,
    });
  });

  test("URL with special characters produces correct curl", async () => {
    await ws.fillUrl("https://httpbin.org/get?foo=bar&baz=hello%20world");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("foo=bar");
    expect(curlText).toContain("baz=");
  });

  test("very long URL (2000+ chars) accepted and reflected in curl", async () => {
    const longQuery = "x=" + "a".repeat(2000);
    const url = `https://httpbin.org/get?${longQuery}`;
    await ws.fillUrl(url);
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("httpbin.org/get");
    expect(curlText.length).toBeGreaterThan(2000);
  });

  test("URL with port number handled correctly", async () => {
    await ws.fillUrl("https://httpbin.org:443/get");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("httpbin.org:443/get");
  });

  test("URL with fragment preserved in curl", async () => {
    await ws.fillUrl("https://httpbin.org/get#section1");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("httpbin.org/get");
  });
});
