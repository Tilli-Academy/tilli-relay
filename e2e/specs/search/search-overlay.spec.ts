import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { uniqueRequestName, uniqueId } from "../../helpers/test-data";

test.describe("Search Overlay", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("opens via Ctrl+K and focuses search input", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.locator(SEL.searchOverlay)).toBeVisible();
    await expect(page.locator(SEL.searchInput)).toBeFocused();
  });

  test("searches requests by name", async ({ page, api }) => {
    const uniqueSuffix = uniqueId();
    const name = `Searchable ${uniqueSuffix}`;
    const req = await api.createRequest(
      name,
      "curl https://httpbin.org/get",
    );
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Control+k");
    await page.locator(SEL.searchInput).fill(uniqueSuffix);
    await expect(page.locator(SEL.searchResult(0))).toBeVisible();
    await expect(page.locator(SEL.searchResult(0))).toContainText(name);
    await api.deleteRequest(req.id);
  });

  test("shows 'No results' for unmatched query", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.locator(SEL.searchInput).fill("zzznonexistent999xyz");
    await expect(page.locator(SEL.searchNoResults)).toBeVisible();
  });

  test("selecting a result loads the request", async ({ page, api }) => {
    const name = uniqueRequestName("Search Load");
    const req = await api.createRequest(
      name,
      "curl -X PUT https://httpbin.org/put",
    );
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Control+k");
    await page.locator(SEL.searchInput).fill(name);
    await expect(page.locator(SEL.searchResult(0))).toBeVisible();
    await page.locator(SEL.searchResult(0)).click();
    await expect(page.locator(SEL.searchOverlay)).not.toBeVisible();
    await expect(page.locator(SEL.methodSelect)).toHaveValue("PUT");
    await expect(page.locator(SEL.urlInput)).toHaveValue(
      "https://httpbin.org/put",
    );
    await api.deleteRequest(req.id);
  });

  test("closes on Escape", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.locator(SEL.searchOverlay)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(SEL.searchOverlay)).not.toBeVisible();
  });

  test("arrow key navigation highlights results", async ({ page, api }) => {
    const req1 = await api.createRequest(
      `Nav Test A ${uniqueId()}`,
      "curl https://httpbin.org/get",
    );
    const req2 = await api.createRequest(
      `Nav Test B ${uniqueId()}`,
      "curl https://httpbin.org/get",
    );
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Control+k");
    await page.locator(SEL.searchInput).fill("Nav Test");
    await expect(page.locator(SEL.searchResult(0))).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(SEL.searchResult(1))).toBeVisible();
    await api.deleteRequest(req1.id);
    await api.deleteRequest(req2.id);
  });
});
