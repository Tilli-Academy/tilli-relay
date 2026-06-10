import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";

test.describe("Body Editor", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
    await ws.selectMethod("POST"); // Body tab only visible for non-GET
    await ws.switchToTab("body");
  });

  test("defaults to None body type", async ({ page }) => {
    await expect(page.locator(SEL.bodyTypeNone)).toHaveClass(
      /bg-tilli/,
    );
  });

  test("switches to JSON body type and shows textarea", async ({ page }) => {
    await page.locator(SEL.bodyTypeJson).click();
    await expect(page.locator(SEL.bodyJsonInput)).toBeVisible();
  });

  test("switches to Text body type and shows textarea", async ({ page }) => {
    await page.locator(SEL.bodyTypeText).click();
    await expect(page.locator(SEL.bodyTextInput)).toBeVisible();
  });

  test("JSON body adds -d flag to curl", async ({ page }) => {
    await page.locator(SEL.bodyTypeJson).click();
    await page.locator(SEL.bodyJsonInput).fill('{"key":"value"}');
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("-d");
    expect(curlText).toContain("key");
  });

  test("Text body updates curl", async ({ page }) => {
    await page.locator(SEL.bodyTypeText).click();
    await page.locator(SEL.bodyTextInput).fill("raw body content");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("raw body content");
  });

  test("Format JSON button formats valid JSON", async ({ page }) => {
    await page.locator(SEL.bodyTypeJson).click();
    await page.locator(SEL.bodyJsonInput).fill('{"a":1,"b":2}');
    await page.locator(SEL.bodyFormatJson).click();
    const value = await page.locator(SEL.bodyJsonInput).inputValue();
    expect(value).toContain("\n");
  });

  test("Format JSON button is disabled for invalid JSON", async ({
    page,
  }) => {
    await page.locator(SEL.bodyTypeJson).click();
    await page.locator(SEL.bodyJsonInput).fill("not valid json {{{");
    await expect(page.locator(SEL.bodyFormatJson)).toBeDisabled();
  });

  test("switching to Form Data type shows form fields", async ({ page }) => {
    await page.locator(SEL.bodyTypeFormData).click();
    await expect(page.locator(SEL.bodyEditor)).toContainText(/Key|Field/i);
  });

  test("body with unicode characters preserved in curl", async ({ page }) => {
    await page.locator(SEL.bodyTypeJson).click();
    await page.locator(SEL.bodyJsonInput).fill('{"emoji":"🚀","cjk":"日本語"}');
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("🚀");
    expect(curlText).toContain("日本語");
  });

  test("large JSON body handled correctly", async ({ page }) => {
    await page.locator(SEL.bodyTypeJson).click();
    const largeObj: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      largeObj[`key_${i}`] = `value_${i}`;
    }
    const json = JSON.stringify(largeObj, null, 2);
    await page.locator(SEL.bodyJsonInput).fill(json);
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("key_0");
    expect(curlText).toContain("key_49");
  });

  test("switching body type shows the correct editor", async ({ page }) => {
    await page.locator(SEL.bodyTypeJson).click();
    await page.locator(SEL.bodyJsonInput).fill('{"data":"test"}');
    // Switch to text body
    await page.locator(SEL.bodyTypeText).click();
    // Text editor should now be visible
    await expect(page.locator(SEL.bodyTextInput)).toBeVisible();
    // JSON editor should no longer be visible
    await expect(page.locator(SEL.bodyJsonInput)).not.toBeVisible();
    // Switching back to JSON should show JSON editor again
    await page.locator(SEL.bodyTypeJson).click();
    await expect(page.locator(SEL.bodyJsonInput)).toBeVisible();
  });
});
