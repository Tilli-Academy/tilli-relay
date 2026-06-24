import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";

test.describe("Query Params Editor", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
    await ws.switchToTab("params");
  });

  test("starts with one empty param row", async ({ page }) => {
    await expect(page.locator(SEL.paramRow(0))).toBeVisible();
    await expect(page.locator(SEL.paramKey(0))).toHaveValue("");
  });

  test("adds a param and it appears in URL", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/get");
    await page.locator(SEL.paramKey(0)).fill("search");
    await page.locator(SEL.paramValue(0)).fill("test");
    await expect(page.locator(SEL.urlInput)).toHaveValue(/search=test/);
  });

  test("disabling a param removes it from URL", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/get");
    await page.locator(SEL.paramKey(0)).fill("removed");
    await page.locator(SEL.paramValue(0)).fill("yes");
    await page.locator(SEL.paramEnabled(0)).uncheck();
    await expect(page.locator(SEL.urlInput)).not.toHaveValue(/removed/);
  });

  test("adds multiple params", async ({ page }) => {
    await ws.fillUrl("https://httpbin.org/get");
    await page.locator(SEL.paramKey(0)).fill("a");
    await page.locator(SEL.paramValue(0)).fill("1");
    await page.locator(SEL.addParam).click();
    await page.locator(SEL.paramKey(1)).fill("b");
    await page.locator(SEL.paramValue(1)).fill("2");
    await expect(page.locator(SEL.urlInput)).toHaveValue(/a=1/);
    await expect(page.locator(SEL.urlInput)).toHaveValue(/b=2/);
  });

  test("URL with query params auto-populates params tab", async ({
    page,
  }) => {
    await ws.fillUrl("https://httpbin.org/get?foo=bar&baz=qux");
    await expect(page.locator(SEL.paramKey(0))).toHaveValue("foo");
    await expect(page.locator(SEL.paramValue(0))).toHaveValue("bar");
    await expect(page.locator(SEL.paramKey(1))).toHaveValue("baz");
    await expect(page.locator(SEL.paramValue(1))).toHaveValue("qux");
  });

  test("removes a param row", async ({ page }) => {
    await page.locator(SEL.addParam).click();
    await page.locator(SEL.paramKey(1)).fill("temp");
    await page.locator(SEL.paramRemove(1)).click();
    await expect(page.locator(SEL.paramRow(1))).not.toBeVisible();
  });
});
