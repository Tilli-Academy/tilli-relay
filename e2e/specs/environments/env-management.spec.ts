import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { uniqueEnvName } from "../../helpers/test-data";

test.describe("Environment Management", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("opens environment panel via button", async ({ page }) => {
    await page.locator(SEL.envVarsButton).click();
    await expect(page.locator(SEL.envPanel)).toBeVisible();
  });

  test("opens environment panel via Ctrl+Shift+E", async ({ page }) => {
    await page.keyboard.press("Control+Shift+e");
    await expect(page.locator(SEL.envPanel)).toBeVisible();
  });

  test("creates a new environment", async ({ page }) => {
    await page.locator(SEL.envVarsButton).click();
    const envName = uniqueEnvName();
    await page.locator(SEL.envNewButton).click();
    await page.locator(SEL.envNewName).fill(envName);
    await page.locator(SEL.envNewConfirm).click();
    await ws.expectToast(/created/i);
    await expect(page.locator(SEL.envPanel)).toContainText(envName);
  });

  test("switches active environment", async ({ page, api }) => {
    const env1 = await api.createEnvironment(uniqueEnvName("Env A"));
    const env2 = await api.createEnvironment(uniqueEnvName("Env B"));
    await api.activateEnvironment(env1.id);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });

    // Activate env2 via switcher
    await page.locator(SEL.envSwitcherButton).click();
    await page.locator(SEL.envOption(env2.id)).click();
    await expect(page.locator(SEL.envSwitcherButton)).toContainText(
      env2.name,
    );

    await api.deleteEnvironment(env1.id);
    await api.deleteEnvironment(env2.id);
  });

  test("deletes an environment", async ({ page, api }) => {
    const env = await api.createEnvironment(uniqueEnvName("To Delete"));
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.locator(SEL.envVarsButton).click();
    await expect(page.locator(SEL.envPanel)).toContainText(env.name);
    // Hover over the env tab to get the delete button
    await page.locator(SEL.envTab(env.id)).hover();
    // Click the trash icon next to the environment tab
    const envGroup = page.locator(SEL.envTab(env.id)).locator("..");
    await envGroup.locator('[title="Delete environment"]').click();
    await ws.expectToast(/deleted/i);
  });

  test("closes panel on Escape", async ({ page }) => {
    await page.locator(SEL.envVarsButton).click();
    await expect(page.locator(SEL.envPanel)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(SEL.envPanel)).not.toBeVisible();
  });

  test("closes panel on backdrop click", async ({ page }) => {
    await page.locator(SEL.envVarsButton).click();
    await expect(page.locator(SEL.envPanel)).toBeVisible();
    await page.locator(SEL.envPanelBackdrop).click({ position: { x: 5, y: 5 } });
    await expect(page.locator(SEL.envPanel)).not.toBeVisible();
  });

  test("environment switcher shows active environment name", async ({
    page,
    api,
  }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    await api.activateEnvironment(env.id);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SEL.envSwitcherButton)).toContainText(
      env.name,
    );
    await api.deleteEnvironment(env.id);
  });

  test("environment switcher shows No Environment when none active", async ({
    page,
  }) => {
    await expect(page.locator(SEL.envSwitcherButton)).toContainText(
      "No Environment",
    );
  });

  test("Manage Environments button opens panel", async ({ page }) => {
    await page.locator(SEL.envSwitcherButton).click();
    await page.locator(SEL.envManageButton).click();
    await expect(page.locator(SEL.envPanel)).toBeVisible();
  });
});
