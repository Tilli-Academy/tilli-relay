import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { uniqueRequestName } from "../../helpers/test-data";

test.describe("Sidebar - Requests CRUD", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("shows empty state when no saved requests", async ({ page, api }) => {
    const requests = await api.listRequests();
    for (const req of requests) {
      await api.deleteRequest(req.id);
    }
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SEL.sidebar)).toContainText("No saved requests");
  });

  test("saves current request via sidebar", async ({ page }) => {
    const name = uniqueRequestName();
    await ws.fillUrl("https://httpbin.org/get");
    await ws.saveRequest(name);
    await ws.expectToast(/saved/i);
    await expect(page.locator(SEL.sidebar)).toContainText(name);
  });

  test("clicking a saved request loads it into the builder", async ({
    page,
    api,
  }) => {
    const name = uniqueRequestName("Load Test");
    const req = await api.createRequest(
      name,
      "curl -X POST https://httpbin.org/post",
    );
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.locator(SEL.requestLoad(req.id)).click();
    await expect(page.locator(SEL.methodSelect)).toHaveValue("POST");
    await expect(page.locator(SEL.urlInput)).toHaveValue(
      "https://httpbin.org/post",
    );
    await api.deleteRequest(req.id);
  });

  test("deletes a request from sidebar", async ({ page, api }) => {
    const name = uniqueRequestName("Delete Test");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SEL.sidebar)).toContainText(name);
    await page.locator(SEL.requestItem(req.id)).hover();
    await page.locator(SEL.requestDelete(req.id)).click();
    await expect(page.locator(SEL.sidebar)).not.toContainText(name);
  });

  test("Ctrl+S opens save prompt", async ({ page }) => {
    await page.keyboard.press("Control+s");
    await expect(page.locator(SEL.saveNameInput)).toBeVisible();
  });

  test("Escape dismisses save prompt", async ({ page }) => {
    await page.locator(SEL.saveCurrentButton).click();
    await expect(page.locator(SEL.saveNameInput)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(SEL.saveNameInput)).not.toBeVisible();
  });

  test("saved request shows correct method badge", async ({ page, api }) => {
    const name = uniqueRequestName("PUT Badge");
    const req = await api.createRequest(
      name,
      "curl -X PUT https://httpbin.org/put",
    );
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SEL.requestItem(req.id))).toContainText("PUT");
    await api.deleteRequest(req.id);
  });

  test("new request button resets the builder", async ({ page }) => {
    await ws.selectMethod("DELETE");
    await ws.fillUrl("https://example.com/something");
    await ws.newRequest();
    await expect(page.locator(SEL.methodSelect)).toHaveValue("GET");
    await expect(page.locator(SEL.urlInput)).toHaveValue("");
  });
});
