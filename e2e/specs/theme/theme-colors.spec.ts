import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("Theme CSS Variable Application", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("dark theme applies correct surface-base color", async ({ page }) => {
    await page.locator(SEL.themeBtnDark).click();
    await page.waitForTimeout(100);

    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--surface-base").trim();
    });
    expect(bgColor).toBe("#09090b");
  });

  test("light theme applies correct surface-base color", async ({ page }) => {
    await page.locator(SEL.themeBtnLight).click();
    await page.waitForTimeout(100);

    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--surface-base").trim();
    });
    expect(bgColor).toBe("#f0f1f3");
  });

  test("light theme applies lighter text colors", async ({ page }) => {
    await page.locator(SEL.themeBtnLight).click();
    await page.waitForTimeout(100);

    const textPrimary = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim();
    });
    // Light theme text-primary should be a dark color
    expect(textPrimary).toBe("#1a1c20");
  });

  test("dark theme text-primary is light colored", async ({ page }) => {
    await page.locator(SEL.themeBtnDark).click();
    await page.waitForTimeout(100);

    const textPrimary = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim();
    });
    expect(textPrimary).toBe("#f4f4f5");
  });

  test("light theme has darker method colors for readability", async ({ page }) => {
    await page.locator(SEL.themeBtnLight).click();
    await page.waitForTimeout(100);

    const methodGet = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--method-get").trim();
    });
    // Light theme uses darker green (#16a34a) vs dark theme (#4ade80)
    expect(methodGet).toBe("#16a34a");
  });

  test("dark theme has bright method colors", async ({ page }) => {
    await page.locator(SEL.themeBtnDark).click();
    await page.waitForTimeout(100);

    const methodGet = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--method-get").trim();
    });
    expect(methodGet).toBe("#4ade80");
  });

  test("light theme has darker syntax key colors for response body", async ({ page }) => {
    await page.locator(SEL.themeBtnLight).click();
    await page.waitForTimeout(100);

    const syntaxKey = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--syntax-key").trim();
    });
    // Light theme uses dark blue (#1e40af) for JSON keys
    expect(syntaxKey).toBe("#1e40af");
  });

  test("light theme borders are visible against light background", async ({ page }) => {
    await page.locator(SEL.themeBtnLight).click();
    await page.waitForTimeout(100);

    const borderPrimary = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--border-primary").trim();
    });
    // Border should be distinct from surface-base (#f0f1f3)
    expect(borderPrimary).toBe("#b8bac0");
  });

  test("response body renders with theme-aware syntax colors", async ({ page }) => {
    // Send a request to get JSON response
    await ws.fillUrl(`${MOCK_BASE}/get`);
    await ws.clickSend();
    await expect(page.locator(SEL.responseStatus)).toBeVisible({ timeout: 15_000 });

    // Switch to light theme
    await page.locator(SEL.themeBtnLight).click();
    await page.waitForTimeout(200);

    // Verify response body is visible and has the pretty view
    await expect(page.locator(SEL.responseBody)).toBeVisible();

    // Check that syntax-key colored elements exist in the response
    const keyElements = page.locator(`${SEL.responseBody} .text-syntax-key`);
    const count = await keyElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("status colors adapt between themes", async ({ page }) => {
    // Check dark theme status success color
    await page.locator(SEL.themeBtnDark).click();
    await page.waitForTimeout(100);

    const darkSuccessText = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--status-success-text").trim();
    });
    expect(darkSuccessText).toBe("#4ade80");

    // Check light theme status success color
    await page.locator(SEL.themeBtnLight).click();
    await page.waitForTimeout(100);

    const lightSuccessText = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--status-success-text").trim();
    });
    expect(lightSuccessText).toBe("#065f46");
  });
});
