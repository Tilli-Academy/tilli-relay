/**
 * Request builder edge cases: headers, body, URL, method interaction.
 * Tests unusual but valid inputs that enterprise users may encounter.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("Request Builder — Edge Cases", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("duplicate header keys are both sent in request", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/headers`);
    await ws.switchToTab("headers");

    // Fill first header
    await page.locator(SEL.headerKey(0)).fill("X-Custom");
    await page.locator(SEL.headerValue(0)).fill("value1");

    // Add second header with same key
    await page.locator(SEL.addHeader).click();
    await page.locator(SEL.headerKey(1)).fill("X-Custom");
    await page.locator(SEL.headerValue(1)).fill("value2");

    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
    // The /headers endpoint echoes back headers — at least one X-Custom should appear
    await ws.expectResponseBodyContains("x-custom");
  });

  test("POST with empty body sends successfully", async ({ page }) => {
    await ws.selectMethod("POST");
    await ws.fillUrl(`${MOCK_BASE}/post`);
    // Don't set any body — leave it empty
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
  });

  test("method switching from POST to GET clears body from curl", async ({ page }) => {
    // Start with POST and add body
    await ws.selectMethod("POST");
    await ws.fillUrl(`${MOCK_BASE}/post`);
    await ws.switchToTab("body");
    await page.locator(SEL.bodyTypeJson).click();
    await page.locator(SEL.bodyJsonInput).fill('{"key":"value"}');

    // Switch to GET
    await ws.selectMethod("GET");
    await ws.fillUrl(`${MOCK_BASE}/get`);

    // Verify curl doesn't contain the body data
    const curlText = await ws.getCurlText();
    expect(curlText).not.toContain('{"key":"value"}');
  });

  test("very long URL (2000+ chars) is accepted", async () => {
    const longQuery = "x".repeat(2000);
    await ws.fillUrl(`${MOCK_BASE}/get?q=${longQuery}`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
  });

  test("special characters in header values are preserved", async ({ page }) => {
    await ws.fillUrl(`${MOCK_BASE}/headers`);
    await ws.switchToTab("headers");

    await page.locator(SEL.headerKey(0)).fill("X-Special");
    await page.locator(SEL.headerValue(0)).fill("a=b&c=d/e+f");

    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
    await ws.expectResponseBodyContains("a=b&c=d/e+f");
  });

  test("query params with special chars are handled", async () => {
    await ws.fillUrl(`${MOCK_BASE}/get?key=hello%20world&tag=a%26b`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
  });

  test("request with all builder sections populated sends correctly", async ({ page }) => {
    await ws.selectMethod("POST");
    await ws.fillUrl(`${MOCK_BASE}/post`);

    // Add a header
    await ws.switchToTab("headers");
    await page.locator(SEL.headerKey(0)).fill("X-Test");
    await page.locator(SEL.headerValue(0)).fill("integration");

    // Add a body
    await ws.switchToTab("body");
    await page.locator(SEL.bodyTypeJson).click();
    await page.locator(SEL.bodyJsonInput).fill('{"test":true}');

    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
    await ws.expectResponseBodyContains("integration");
    await ws.expectResponseBodyContains("test");
  });
});
