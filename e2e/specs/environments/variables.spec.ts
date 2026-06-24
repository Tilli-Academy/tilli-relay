import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { uniqueEnvName, uniqueId } from "../../helpers/test-data";

test.describe("Environment Variables", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("adds a variable to an environment", async ({ page, api }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.locator(SEL.envVarsButton).click();
    await page.locator(SEL.envTab(env.id)).click();

    const varKey = `TEST_VAR_${uniqueId().replace(/-/g, "_").toUpperCase()}`;
    await page.locator(SEL.envVarNewKey).fill(varKey);
    await page.locator(SEL.envVarNewValue).fill("test-value-123");
    await page.locator(SEL.envVarNewAdd).click();
    await ws.expectToast(/created/i);
    await expect(page.locator(SEL.envPanel)).toContainText(varKey);
    await api.deleteEnvironment(env.id);
  });

  test("adds a secret variable that shows masked value", async ({
    page,
    api,
  }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.locator(SEL.envVarsButton).click();
    await page.locator(SEL.envTab(env.id)).click();

    const varKey = `SECRET_${uniqueId().replace(/-/g, "_").toUpperCase()}`;
    await page.locator(SEL.envVarNewKey).fill(varKey);
    await page.locator(SEL.envVarNewValue).fill("secret-value");
    await page.locator(SEL.envVarNewSecret).check();
    await page.locator(SEL.envVarNewAdd).click();
    await ws.expectToast(/created/i);
    await expect(page.locator(SEL.envPanel)).toContainText("••••••••");
    await api.deleteEnvironment(env.id);
  });

  test("deletes a variable", async ({ page, api }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    const variable = await api.createVariable(
      `DEL_VAR_${uniqueId().replace(/-/g, "_").toUpperCase()}`,
      "to-be-deleted",
      env.id,
    );
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.locator(SEL.envVarsButton).click();
    await page.locator(SEL.envTab(env.id)).click();
    await expect(page.locator(SEL.envPanel)).toContainText(variable.key);
    await page.locator(SEL.envVarDelete(variable.id)).click();
    await ws.expectToast(/deleted/i);
    await api.deleteEnvironment(env.id);
  });

  test("shows error for duplicate variable key", async ({ page, api }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    const varKey = `DUP_${uniqueId().replace(/-/g, "_").toUpperCase()}`;
    await api.createVariable(varKey, "first", env.id);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.locator(SEL.envVarsButton).click();
    await page.locator(SEL.envTab(env.id)).click();
    await page.locator(SEL.envVarNewKey).fill(varKey);
    await page.locator(SEL.envVarNewValue).fill("second");
    await page.locator(SEL.envVarNewAdd).click();
    await ws.expectToast(/already exists|duplicate/i);
    await api.deleteEnvironment(env.id);
  });

  test("shows 'No variables' for empty environment", async ({
    page,
    api,
  }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.locator(SEL.envVarsButton).click();
    await page.locator(SEL.envTab(env.id)).click();
    await expect(page.locator(SEL.envPanel)).toContainText(
      "No variables in this environment",
    );
    await api.deleteEnvironment(env.id);
  });
});
