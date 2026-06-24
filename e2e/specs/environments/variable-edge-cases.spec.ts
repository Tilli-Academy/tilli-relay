/**
 * Environment variable edge cases: secret masking, validation, limits.
 * Tests boundary conditions for the variable system in an enterprise context.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { uniqueEnvName, MOCK_BASE } from "../../helpers/test-data";

test.describe("Environment Variable — Edge Cases", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("secret variable value is masked in UI", async ({ page, api }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    const variable = await api.createVariable("MY_SECRET", "super-secret-value", env.id, true);
    await api.activateEnvironment(env.id);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });

    try {
      // Open environment panel
      await page.locator(SEL.envVarsButton).click();
      await expect(page.locator(SEL.envPanel)).toBeVisible({ timeout: 5_000 });

      // Click the environment tab
      await page.locator(SEL.envTab(env.id)).click();

      // The secret value should NOT be visible as plain text
      const varRow = page.locator(SEL.envVar(variable.id));
      if (await varRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const rowText = await varRow.textContent();
        expect(rowText).not.toContain("super-secret-value");
      }
    } finally {
      await page.locator(SEL.envPanelClose).click().catch(() => {});
      await api.deleteVariable(variable.id);
      await api.deleteEnvironment(env.id);
    }
  });

  test("empty variable key is rejected by API", async ({ api }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    try {
      const res = await api.rawPost("/api/variables", {
        key: "",
        value: "test",
        environmentId: env.id,
      });
      // Should reject — 400 or 422
      expect([400, 422]).toContain(res.status());
    } finally {
      await api.deleteEnvironment(env.id);
    }
  });

  test("very long variable value is accepted and used in substitution", async ({ page, api }) => {
    test.setTimeout(60_000);
    const env = await api.createEnvironment(uniqueEnvName());
    const longValue = "V".repeat(5000);
    await api.createVariable("LONG_VAR", longValue, env.id);
    await api.activateEnvironment(env.id);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SEL.envSwitcherButton)).not.toContainText("No Environment", { timeout: 10_000 });

    try {
      // Use the variable in a header — the value should be substituted
      await ws.fillUrl(`${MOCK_BASE}/headers`);
      await ws.switchToTab("headers");
      await page.locator(SEL.headerKey(0)).fill("X-Long");
      await page.locator(SEL.headerValue(0)).fill("{{LONG_VAR}}");
      await ws.sendAndWaitForResponse();
      await ws.expectStatus(200);
      // The /headers endpoint should echo back the header (at least partial match)
      await ws.expectResponseBodyContains("VVVVV");
    } finally {
      await api.deleteEnvironment(env.id);
    }
  });

  test("delete last variable in environment works via API", async ({ api }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    const variable = await api.createVariable("ONLY_VAR", "value", env.id);

    try {
      // Delete the only variable
      const res = await api.rawDelete(`/api/variables/${variable.id}`);
      expect(res.status()).toBe(200);
    } finally {
      await api.deleteEnvironment(env.id);
    }
  });

  test("secret variable is still substituted in execution", async ({ api }) => {
    test.setTimeout(45_000);
    const env = await api.createEnvironment(uniqueEnvName());
    await api.createVariable("SECRET_TOKEN", "bearer-secret-123", env.id, true);
    await api.activateEnvironment(env.id);

    try {
      // Execute with the secret variable — it should be resolved
      const result = await api.executeRequest(
        `curl -H "Authorization: {{SECRET_TOKEN}}" ${MOCK_BASE}/headers`
      );
      expect(result.status).toBe(200);
      // The headers endpoint should show the resolved value
      expect(result.body).toContain("bearer-secret-123");
    } finally {
      await api.deleteEnvironment(env.id);
    }
  });

  test("variable with invalid key characters is rejected", async ({ api }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    try {
      // Keys with dashes and dots should be rejected (only letters, digits, underscores allowed)
      const res = await api.rawPost("/api/variables", {
        key: "MY_VAR-2.0",
        value: "special-val",
        environmentId: env.id,
      });
      expect([400, 422]).toContain(res.status());
      const body = await res.json();
      expect(body.error).toMatch(/key|letter|underscore/i);
    } finally {
      await api.deleteEnvironment(env.id);
    }
  });

  test("creating environment returns proper structure", async ({ api }) => {
    const name = uniqueEnvName();
    const env = await api.createEnvironment(name);
    try {
      expect(env).toHaveProperty("id");
      expect(env.name).toBe(name);
      expect(env).toHaveProperty("isActive");
    } finally {
      await api.deleteEnvironment(env.id);
    }
  });
});
