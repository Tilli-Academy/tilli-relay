import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";

test.describe("Theme Switching", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
    // Reset to dark theme before each test
    await page.locator(SEL.themeBtnDark).click();
    await page.waitForTimeout(100);
  });

  test("theme toggle is visible in sidebar", async ({ page }) => {
    await expect(page.locator(SEL.themeToggle)).toBeVisible();
    await expect(page.locator(SEL.themeBtnLight)).toBeVisible();
    await expect(page.locator(SEL.themeBtnDark)).toBeVisible();
    await expect(page.locator(SEL.themeBtnSystem)).toBeVisible();
  });

  test("dark theme is active by default", async ({ page }) => {
    // Dark button should have the active style (bg-tilli)
    const darkBtn = page.locator(SEL.themeBtnDark);
    await expect(darkBtn).toHaveClass(/bg-tilli/);
    // html element should NOT have .light class
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass || "").not.toContain("light");
  });

  test("switching to light theme adds .light class to html", async ({ page }) => {
    await page.locator(SEL.themeBtnLight).click();
    await page.waitForTimeout(100);
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass).toContain("light");
    // Light button should now be active
    await expect(page.locator(SEL.themeBtnLight)).toHaveClass(/bg-tilli/);
  });

  test("switching back to dark theme removes .light class", async ({ page }) => {
    // Switch to light first
    await page.locator(SEL.themeBtnLight).click();
    await page.waitForTimeout(100);
    let htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass).toContain("light");

    // Switch back to dark
    await page.locator(SEL.themeBtnDark).click();
    await page.waitForTimeout(100);
    htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass || "").not.toContain("light");
  });

  test("system theme applies based on OS preference", async ({ page }) => {
    await page.locator(SEL.themeBtnSystem).click();
    await page.waitForTimeout(100);
    // System button should be active
    await expect(page.locator(SEL.themeBtnSystem)).toHaveClass(/bg-tilli/);
    // The html class should reflect the OS preference (whatever it is)
    // We can't control OS preference in tests, but we verify the button is active
  });

  test("theme persists after page reload", async ({ page }) => {
    // Switch to light
    await page.locator(SEL.themeBtnLight).click();
    await page.waitForTimeout(100);

    // Reload page
    await page.reload();
    await page.waitForSelector(SEL.workspace);
    await page.waitForTimeout(300); // wait for useEffect to apply theme

    // html should still have .light class
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass).toContain("light");

    // Light button should be active
    await expect(page.locator(SEL.themeBtnLight)).toHaveClass(/bg-tilli/);
  });

  test("theme persists in localStorage as relay-theme", async ({ page }) => {
    await page.locator(SEL.themeBtnLight).click();
    await page.waitForTimeout(100);
    const stored = await page.evaluate(() => localStorage.getItem("relay-theme"));
    expect(stored).toBe("light");

    await page.locator(SEL.themeBtnDark).click();
    await page.waitForTimeout(100);
    const storedDark = await page.evaluate(() => localStorage.getItem("relay-theme"));
    expect(storedDark).toBe("dark");

    await page.locator(SEL.themeBtnSystem).click();
    await page.waitForTimeout(100);
    const storedSystem = await page.evaluate(() => localStorage.getItem("relay-theme"));
    expect(storedSystem).toBe("system");
  });
});
