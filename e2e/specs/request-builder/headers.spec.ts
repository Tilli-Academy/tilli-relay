import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";

test.describe("Headers Editor", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
    await ws.switchToTab("headers");
  });

  test("starts with one empty header row", async ({ page }) => {
    await expect(page.locator(SEL.headerRow(0))).toBeVisible();
    await expect(page.locator(SEL.headerKey(0))).toHaveValue("");
    await expect(page.locator(SEL.headerValue(0))).toHaveValue("");
  });

  test("adds a new header row", async ({ page }) => {
    await page.locator(SEL.addHeader).click();
    await expect(page.locator(SEL.headerRow(1))).toBeVisible();
  });

  test("fills header key and value and updates curl", async ({ page }) => {
    await page.locator(SEL.headerKey(0)).fill("X-Custom-Header");
    await page.locator(SEL.headerValue(0)).fill("test-value");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("X-Custom-Header");
    expect(curlText).toContain("test-value");
  });

  test("disables a header via checkbox and excludes from curl", async ({
    page,
  }) => {
    await page.locator(SEL.headerKey(0)).fill("X-Disabled");
    await page.locator(SEL.headerValue(0)).fill("should-not-appear");
    await page.locator(SEL.headerEnabled(0)).uncheck();
    const curlText = await ws.getCurlText();
    expect(curlText).not.toContain("X-Disabled");
  });

  test("removes a header row", async ({ page }) => {
    await page.locator(SEL.addHeader).click();
    await page.locator(SEL.headerKey(1)).fill("ToRemove");
    await page.locator(SEL.headerRemove(1)).click();
    await expect(page.locator(SEL.headerRow(1))).not.toBeVisible();
  });

  test("multiple headers appear in curl", async ({ page }) => {
    await page.locator(SEL.headerKey(0)).fill("Accept");
    await page.locator(SEL.headerValue(0)).fill("application/json");
    await page.locator(SEL.addHeader).click();
    await page.locator(SEL.headerKey(1)).fill("X-Request-Id");
    await page.locator(SEL.headerValue(1)).fill("123");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("Accept");
    expect(curlText).toContain("X-Request-Id");
  });
});
