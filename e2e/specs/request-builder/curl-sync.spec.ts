import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";

test.describe("Curl Panel Synchronization", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("curl panel shows valid curl command on load", async () => {
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("curl");
  });

  test("changing method updates curl panel", async () => {
    await ws.selectMethod("POST");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("-X POST");
  });

  test("changing URL updates curl panel", async () => {
    await ws.fillUrl("https://example.com/api/v1/test");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("https://example.com/api/v1/test");
  });

  test("adding headers updates curl panel", async ({ page }) => {
    await ws.switchToTab("headers");
    await page.locator(SEL.headerKey(0)).fill("Authorization");
    await page.locator(SEL.headerValue(0)).fill("Bearer xyz");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("-H");
    expect(curlText).toContain("Authorization");
  });

  test("copy button copies curl and shows Copied state", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await ws.fillUrl("https://httpbin.org/get");
    await page.locator(SEL.curlCopyButton).click();
    await expect(page.locator(SEL.curlCopyButton)).toContainText("Copied");
  });

  test("combined method + URL + header produces correct curl", async ({
    page,
  }) => {
    await ws.selectMethod("DELETE");
    await ws.fillUrl("https://httpbin.org/delete");
    await ws.switchToTab("headers");
    await page.locator(SEL.headerKey(0)).fill("Accept");
    await page.locator(SEL.headerValue(0)).fill("*/*");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("-X DELETE");
    expect(curlText).toContain("https://httpbin.org/delete");
    expect(curlText).toContain("Accept");
  });
});

// ── Reverse sync: editing curl text updates UI fields ──

test.describe("Curl Editor → UI Reverse Sync", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  /**
   * Helper: clear Monaco editor and type a new curl command.
   * Click the visible editor area to focus, then use keyboard to replace content.
   * Monaco's internal textarea is hidden behind rendered spans, so we must
   * click the visible `.lines-content` area and use { force: true } as fallback.
   * After typing, wait for the 300ms debounce to fire.
   */
  async function setCurlInEditor(page: import("@playwright/test").Page, curl: string) {
    // Click the visible editor lines area to focus Monaco
    const editorArea = page.locator(`${SEL.curlEditor} .monaco-editor .view-lines`);
    await editorArea.click({ force: true });
    await page.waitForTimeout(100);
    // Select all existing content and replace
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(curl, { delay: 5 });
    // Wait for 300ms debounce + buffer
    await page.waitForTimeout(500);
  }

  test("editing curl URL updates the URL input field", async ({ page }) => {
    await setCurlInEditor(page, "curl https://api.example.com/users");
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://api.example.com/users");
  });

  test("editing curl with -X POST updates method dropdown", async ({ page }) => {
    await setCurlInEditor(page, "curl -X POST https://httpbin.org/post");
    await expect(page.locator(SEL.methodSelect)).toHaveValue("POST");
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://httpbin.org/post");
  });

  test("editing curl with -X PUT updates method to PUT", async ({ page }) => {
    await setCurlInEditor(page, "curl -X PUT https://httpbin.org/put");
    await expect(page.locator(SEL.methodSelect)).toHaveValue("PUT");
  });

  test("editing curl with headers updates headers editor", async ({ page }) => {
    await setCurlInEditor(
      page,
      'curl -H "X-Custom: hello-world" https://httpbin.org/get'
    );
    await ws.switchToTab("headers");
    // Verify first header row is populated with the parsed header
    await expect(page.locator(SEL.headerKey(0))).toHaveValue("X-Custom");
    await expect(page.locator(SEL.headerValue(0))).toHaveValue("hello-world");
  });

  test("editing curl with -d updates body editor", async ({ page }) => {
    await setCurlInEditor(
      page,
      'curl -X POST -d \'{"name":"test"}\' https://httpbin.org/post'
    );
    await expect(page.locator(SEL.methodSelect)).toHaveValue("POST");
    await ws.switchToTab("body");
    // Body type should switch to JSON or Text and contain the data
    const bodyInput = page.locator(`${SEL.bodyJsonInput}, ${SEL.bodyTextInput}`).first();
    await expect(bodyInput).toContainText('{"name":"test"}');
  });

  test("editing curl with basic auth updates auth fields", async ({ page }) => {
    await setCurlInEditor(page, "curl -u admin:secret https://httpbin.org/get");
    await ws.switchToTab("auth");
    await expect(page.locator(SEL.authBasicUsername)).toHaveValue("admin");
    await expect(page.locator(SEL.authBasicPassword)).toHaveValue("secret");
  });

  test("editing curl with bearer token updates auth fields", async ({ page }) => {
    await setCurlInEditor(
      page,
      'curl -H "Authorization: Bearer mytoken123" https://httpbin.org/get'
    );
    await ws.switchToTab("auth");
    await expect(page.locator(SEL.authBearerToken)).toHaveValue("mytoken123");
  });

  test("full roundtrip: UI → curl → edit curl → UI reflects changes", async ({ page }) => {
    // Step 1: Set up via UI
    await ws.selectMethod("GET");
    await ws.fillUrl("https://example.com/original");
    const curlBefore = await ws.getCurlText();
    expect(curlBefore).toContain("https://example.com/original");

    // Step 2: Edit curl directly to change method and URL
    await setCurlInEditor(page, "curl -X PATCH https://example.com/updated");

    // Step 3: Verify UI updated
    await expect(page.locator(SEL.methodSelect)).toHaveValue("PATCH");
    await expect(page.locator(SEL.urlInput)).toHaveValue("https://example.com/updated");
  });
});
