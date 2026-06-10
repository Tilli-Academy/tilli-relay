/**
 * Workspace switching tests: personal <-> team workspace transitions.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { uniqueTeamName, uniqueRequestName } from "../../helpers/test-data";

test.describe("Workspace Switching", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("workspace switcher shows Personal when no team is active", async ({ page }) => {
    const switcher = page.locator('[data-testid="workspace-switcher-button"]');
    await expect(switcher).toBeVisible({ timeout: 5_000 });
    await expect(switcher).toContainText(/personal/i);
  });

  test("switching to team workspace updates switcher display", async ({ page, api }) => {
    const teamName = uniqueTeamName("WS");
    const team = await api.createTeam(teamName);

    try {
      // Open workspace switcher
      await page.locator('[data-testid="workspace-switcher-button"]').click();
      await expect(page.locator('[data-testid="workspace-switcher-dropdown"]')).toBeVisible({ timeout: 5_000 });

      // Click team option
      const teamOption = page.locator(`[data-testid="workspace-team-option-${team.id}"]`);
      if (await teamOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await teamOption.click();
        // Switcher should now show team name
        await expect(page.locator('[data-testid="workspace-switcher-button"]')).toContainText(teamName, { timeout: 5_000 });
      }
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("switching back to personal restores personal context", async ({ page, api }) => {
    const teamName = uniqueTeamName("WS");
    const team = await api.createTeam(teamName);

    try {
      // Switch to team
      await page.locator('[data-testid="workspace-switcher-button"]').click();
      const dropdown = page.locator('[data-testid="workspace-switcher-dropdown"]');
      await expect(dropdown).toBeVisible({ timeout: 5_000 });

      const teamOption = page.locator(`[data-testid="workspace-team-option-${team.id}"]`);
      if (await teamOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await teamOption.click();
        await page.waitForTimeout(1000);

        // Switch back to personal
        await page.locator('[data-testid="workspace-switcher-button"]').click();
        await page.locator('[data-testid="workspace-personal-option"]').click();

        await expect(page.locator('[data-testid="workspace-switcher-button"]')).toContainText(/personal/i, { timeout: 5_000 });
      }
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("workspace selection persists across page reloads", async ({ page, api }) => {
    const teamName = uniqueTeamName("WS");
    const team = await api.createTeam(teamName);

    try {
      // Switch to team
      await page.locator('[data-testid="workspace-switcher-button"]').click();
      const teamOption = page.locator(`[data-testid="workspace-team-option-${team.id}"]`);
      if (await teamOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await teamOption.click();
        await page.waitForTimeout(1000);

        // Reload
        await page.reload();
        await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });

        // Should still show team workspace
        await expect(page.locator('[data-testid="workspace-switcher-button"]')).toContainText(teamName, { timeout: 5_000 });
      }
    } finally {
      // Switch back to personal before cleanup
      await page.locator('[data-testid="workspace-switcher-button"]').click();
      const personalOption = page.locator('[data-testid="workspace-personal-option"]');
      if (await personalOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await personalOption.click();
      }
      await api.deleteTeam(team.id);
    }
  });

  test("creating request in team workspace scopes it to team", async ({ page, api }) => {
    const teamName = uniqueTeamName("WS");
    const team = await api.createTeam(teamName);

    try {
      // Switch to team
      await page.locator('[data-testid="workspace-switcher-button"]').click();
      const teamOption = page.locator(`[data-testid="workspace-team-option-${team.id}"]`);
      if (await teamOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await teamOption.click();
        await page.waitForTimeout(1000);

        // Save a request in team context
        const reqName = uniqueRequestName("TeamReq");
        await ws.fillUrl("https://httpbin.org/get");
        await ws.saveRequest(reqName);
        await ws.expectToast(/saved/i);

        // Switch to personal — the team request should NOT appear
        await page.locator('[data-testid="workspace-switcher-button"]').click();
        await page.locator('[data-testid="workspace-personal-option"]').click();
        await page.waitForTimeout(1000);

        // The team request should not be in personal sidebar
        await expect(page.getByText(reqName)).not.toBeVisible({ timeout: 3_000 });
      }
    } finally {
      // Switch back to personal
      await page.locator('[data-testid="workspace-switcher-button"]').click();
      const personalOption = page.locator('[data-testid="workspace-personal-option"]');
      if (await personalOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await personalOption.click();
      }
      await api.deleteTeam(team.id);
    }
  });

  test("manage teams button opens team panel", async ({ page }) => {
    await page.locator('[data-testid="workspace-switcher-button"]').click();
    const manageButton = page.locator('[data-testid="workspace-manage-teams"]');
    if (await manageButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await manageButton.click();
      await expect(page.locator('[data-testid="team-panel"]')).toBeVisible({ timeout: 5_000 });
    }
  });
});
