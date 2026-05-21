import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";

test.describe("Auth Editor", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
    await ws.switchToTab("auth");
  });

  test("defaults to None auth type", async ({ page }) => {
    await expect(page.locator(SEL.authTypeNone)).toHaveClass(
      /bg-tilli/,
    );
  });

  test("switches to Basic auth and shows fields", async ({ page }) => {
    await page.locator(SEL.authTypeBasic).click();
    await expect(page.locator(SEL.authBasicUsername)).toBeVisible();
    await expect(page.locator(SEL.authBasicPassword)).toBeVisible();
  });

  test("switches to Bearer auth and shows token field", async ({ page }) => {
    await page.locator(SEL.authTypeBearer).click();
    await expect(page.locator(SEL.authBearerToken)).toBeVisible();
  });

  test("switches to API Key auth and shows fields", async ({ page }) => {
    await page.locator(SEL.authTypeApikey).click();
    await expect(page.locator(SEL.authApikeyKey)).toBeVisible();
    await expect(page.locator(SEL.authApikeyValue)).toBeVisible();
    await expect(page.locator(SEL.authApikeyAddto)).toBeVisible();
  });

  test("Basic auth adds -u flag to curl", async ({ page }) => {
    await page.locator(SEL.authTypeBasic).click();
    await page.locator(SEL.authBasicUsername).fill("myuser");
    await page.locator(SEL.authBasicPassword).fill("mypass");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("-u");
    expect(curlText).toContain("myuser:mypass");
  });

  test("Bearer auth adds Authorization header to curl", async ({ page }) => {
    await page.locator(SEL.authTypeBearer).click();
    await page.locator(SEL.authBearerToken).fill("my-secret-token");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("Authorization");
    expect(curlText).toContain("Bearer my-secret-token");
  });

  test("API Key header mode adds -H flag to curl", async ({ page }) => {
    await page.locator(SEL.authTypeApikey).click();
    await page.locator(SEL.authApikeyKey).fill("X-API-Key");
    await page.locator(SEL.authApikeyValue).fill("key123");
    await page.locator(SEL.authApikeyAddto).selectOption("header");
    const curlText = await ws.getCurlText();
    expect(curlText).toContain("X-API-Key");
    expect(curlText).toContain("key123");
  });

  test("switching back to None removes auth from curl", async ({ page }) => {
    await page.locator(SEL.authTypeBasic).click();
    await page.locator(SEL.authBasicUsername).fill("user");
    await page.locator(SEL.authBasicPassword).fill("pass");
    await page.locator(SEL.authTypeNone).click();
    const curlText = await ws.getCurlText();
    expect(curlText).not.toContain("-u");
    expect(curlText).not.toContain("user:pass");
  });
});
