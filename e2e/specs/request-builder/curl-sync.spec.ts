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
