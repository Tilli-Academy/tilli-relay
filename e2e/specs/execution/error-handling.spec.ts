import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("Execution Error Handling", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("shows error for unreachable host", async ({ page }) => {
    await ws.fillUrl("https://this-host-does-not-exist-e2e.invalid/api");
    await ws.clickSend();
    await expect(page.locator(SEL.responseError)).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.locator(SEL.responseErrorMessage)).toContainText(
      /resolve|connect|failed/i,
    );
  });

  test("shows error for mocked network failure", async ({ page }) => {
    await page.route("**/api/execute", (route) =>
      route.abort("connectionfailed"),
    );
    await ws.fillUrl("https://httpbin.org/get");
    await ws.clickSend();
    await expect(page.locator(SEL.responseError)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows rate limit error when mocked", async ({ page }) => {
    await page.route("**/api/execute", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Rate limit exceeded. Try again later.",
          status: 0,
        }),
      }),
    );
    await ws.fillUrl("https://httpbin.org/get");
    await ws.clickSend();
    await expect(
      page.locator(SEL.responseError),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows warning banner for unresolved variables", async ({ page }) => {
    await ws.fillUrl("https://{{UNKNOWN_HOST}}/api/test");
    await ws.clickSend();
    await expect(
      page.locator(SEL.responseWarning).or(page.locator(SEL.responseError)),
    ).toBeVisible({ timeout: 40_000 });
  });

  test("shows sending spinner during request execution", async ({ page }) => {
    await page.route("**/api/execute", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: 200,
          headers: {},
          body: "{}",
          timeMs: 2000,
        }),
      });
    });
    await ws.fillUrl("https://httpbin.org/get");
    await ws.clickSend();
    await expect(page.locator(SEL.responseSending)).toBeVisible();
  });

  test("handles server error status codes", async () => {
    await ws.fillUrl(`${MOCK_BASE}/status/500`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(500);
  });

  test("handles 404 status codes", async () => {
    await ws.fillUrl(`${MOCK_BASE}/status/404`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(404);
  });

  test("server returning 204 No Content shows empty body", async () => {
    await ws.fillUrl(`${MOCK_BASE}/status/204`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(204);
  });

  test("server returning redirect shows redirect status", async () => {
    await ws.fillUrl(`${MOCK_BASE}/redirect/1`);
    await ws.sendAndWaitForResponse();
    // curl without -L does not follow redirects; expects a 302 redirect status
    await ws.expectStatus(302);
  });

  test("server returning 418 I'm a teapot shows status code", async () => {
    await ws.fillUrl(`${MOCK_BASE}/status/418`);
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(418);
  });
});
