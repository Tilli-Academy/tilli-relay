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
});
