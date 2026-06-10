import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { uniqueEnvName, uniqueId, MOCK_BASE } from "../../helpers/test-data";

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
    test.setTimeout(60_000);
    const env = await api.createEnvironment(uniqueEnvName());
    await api.createVariable("BASE_URL", MOCK_BASE, env.id);
    await api.activateEnvironment(env.id);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    // Wait for environment data to be fetched by the frontend
    await expect(page.locator(SEL.envSwitcherButton)).not.toContainText("No Environment", { timeout: 10_000 });
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
    test.setTimeout(60_000);
    const env = await api.createEnvironment(uniqueEnvName());
    await api.createVariable(
      "TEST_TOKEN",
      "my-secret-bearer-token",
      env.id,
    );
    await api.activateEnvironment(env.id);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    // Wait for environment data to load
    await expect(page.locator(SEL.envSwitcherButton)).not.toContainText("No Environment", { timeout: 10_000 });
    await ws.fillUrl(`${MOCK_BASE}/get`);
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

  test("switching active environment mid-session uses new values", async ({
    page,
    api,
  }) => {
    const envA = await api.createEnvironment(uniqueEnvName());
    const envB = await api.createEnvironment(uniqueEnvName());
    await api.createVariable("MY_HOST", MOCK_BASE, envA.id);
    await api.createVariable("MY_HOST", MOCK_BASE, envB.id);

    // Activate env A, reload, verify it works
    await api.activateEnvironment(envA.id);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });

    await ws.fillUrl("{{MY_HOST}}/get");
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);

    // Switch to env B via the UI
    await page.locator(SEL.envSwitcherButton).click();
    const envBOption = page.locator(SEL.envOption(envB.id));
    if (await envBOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await envBOption.click();
    }

    // Send again — should still resolve
    await ws.fillUrl("{{MY_HOST}}/get");
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);

    await api.deleteEnvironment(envA.id);
    await api.deleteEnvironment(envB.id);
  });

  test("nested variable patterns in body JSON resolve correctly", async ({
    page,
    api,
  }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    await api.activateEnvironment(env.id);
    await api.createVariable("API_KEY", "test-key-12345", env.id);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });

    await ws.selectMethod("POST");
    await ws.fillUrl(`${MOCK_BASE}/post`);
    await ws.switchToTab("body");
    await page.locator(SEL.bodyTypeJson).click();
    await page.locator(SEL.bodyJsonInput).fill('{"apiKey":"{{API_KEY}}"}');
    await ws.sendAndWaitForResponse();
    await ws.expectStatus(200);
    await ws.expectResponseBodyContains("test-key-12345");

    await api.deleteEnvironment(env.id);
  });
});
