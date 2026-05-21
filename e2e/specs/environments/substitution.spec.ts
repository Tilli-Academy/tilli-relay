import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { uniqueEnvName, uniqueId } from "../../helpers/test-data";

test.describe("Variable Substitution in Execution", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("{{BASE_URL}} in URL is resolved during execution", async ({
    page,
    api,
  }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    await api.activateEnvironment(env.id);
    await api.createVariable("BASE_URL", "https://httpbin.org", env.id);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await ws.fillUrl("{{BASE_URL}}/get");
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
    await api.deleteEnvironment(env.id);
  });

  test("unresolved variables show warning in response", async ({ page }) => {
    await ws.fillUrl("https://{{UNDEFINED_VAR}}/get");
    await ws.clickSend();
    await expect(
      page.locator(SEL.responseWarning).or(page.locator(SEL.responseError)),
    ).toBeVisible({ timeout: 40_000 });
  });

  test("variables from active environment are used in headers", async ({
    page,
    api,
  }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    await api.activateEnvironment(env.id);
    await api.createVariable(
      "TEST_TOKEN",
      "my-secret-bearer-token",
      env.id,
    );
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await ws.fillUrl("https://httpbin.org/get");
    await ws.switchToTab("headers");
    await page.locator(SEL.headerKey(0)).fill("Authorization");
    await page.locator(SEL.headerValue(0)).fill("Bearer {{TEST_TOKEN}}");
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
    await ws.expectResponseBodyContains("my-secret-bearer-token");
    await api.deleteEnvironment(env.id);
  });

  test("No Environment means no substitution", async ({ page }) => {
    await expect(page.locator(SEL.envSwitcherButton)).toContainText(
      "No Environment",
    );
    await ws.fillUrl("https://{{SOME_VAR}}/api");
    await ws.clickSend();
    await expect(
      page.locator(SEL.responseWarning).or(page.locator(SEL.responseError)),
    ).toBeVisible({ timeout: 40_000 });
  });
});
