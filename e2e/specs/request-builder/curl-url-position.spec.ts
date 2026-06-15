import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";

/**
 * Tests for the curl parser URL detection fix.
 * The parser should correctly detect URLs regardless of their position
 * in the curl command (beginning, middle, or end).
 * URLs starting with http:// or https:// are preferred over bare tokens.
 */
test.describe("Curl URL Position Detection", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  /**
   * Helper: clear Monaco editor and type a new curl command.
   */
  async function setCurlInEditor(page: import("@playwright/test").Page, curl: string) {
    const editorArea = page.locator(`${SEL.curlEditor} .monaco-editor .view-lines`);
    await editorArea.click({ force: true });
    await page.waitForTimeout(100);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(curl, { delay: 5 });
    await page.waitForTimeout(500);
  }

  test("URL at the beginning of curl command is detected", async ({ page }) => {
    await setCurlInEditor(page, "curl https://api.example.com/users -X GET");
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://api.example.com/users");
    await expect(page.locator(SEL.methodSelect)).toHaveValue("GET");
  });

  test("URL at the end of curl command is detected", async ({ page }) => {
    await setCurlInEditor(page, "curl -X POST https://api.example.com/users");
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://api.example.com/users");
    await expect(page.locator(SEL.methodSelect)).toHaveValue("POST");
  });

  test("URL in the middle of curl command is detected", async ({ page }) => {
    await setCurlInEditor(
      page,
      'curl -X PUT https://api.example.com/users -H "Content-Type: application/json"'
    );
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://api.example.com/users");
    await expect(page.locator(SEL.methodSelect)).toHaveValue("PUT");
  });

  test("URL with headers before and after is detected correctly", async ({ page }) => {
    await setCurlInEditor(
      page,
      'curl -H "Accept: application/json" https://httpbin.org/get -H "X-Custom: value"'
    );
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://httpbin.org/get");
  });

  test("http:// URL at end is detected over bare tokens", async ({ page }) => {
    await setCurlInEditor(page, "curl -X DELETE http://localhost:9444/delete");
    await expect(page.locator(SEL.urlInput)).toHaveValue("http://localhost:9444/delete");
    await expect(page.locator(SEL.methodSelect)).toHaveValue("DELETE");
  });

  test("URL with query params at end is fully captured", async ({ page }) => {
    await setCurlInEditor(
      page,
      "curl -X GET https://api.example.com/search?q=test&page=1"
    );
    await expect(page.locator(SEL.urlInput)).toHaveValue(
      "https://api.example.com/search?q=test&page=1"
    );
  });

  test("URL with port number at end is detected", async ({ page }) => {
    await setCurlInEditor(page, "curl -X PATCH https://localhost:3000/api/v1/items");
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://localhost:3000/api/v1/items");
    await expect(page.locator(SEL.methodSelect)).toHaveValue("PATCH");
  });
});
