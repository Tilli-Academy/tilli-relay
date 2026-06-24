/**
 * Team activity log e2e tests.
 * Validates that team operations are logged in the activity feed.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { uniqueTeamName } from "../../helpers/test-data";

test.describe("Team Activity Log", () => {
  test("adding a member logs member.added activity", async ({
    api,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("ActivityAdd"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "editor");

      // Allow time for activity log write
      await new Promise((r) => setTimeout(r, 500));

      const activity = await api.getTeamActivity(team.id);
      expect(Array.isArray(activity.entries)).toBe(true);
      const addEntry = activity.entries.find(
        (e: { action: string }) => e.action === "member.added",
      );
      expect(addEntry).toBeTruthy();
      expect(addEntry.resourceName).toContain(secondUser.email);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("removing a member logs member.removed activity", async ({
    api,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("ActivityRem"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "editor");

      const detail = await api.getTeam(team.id);
      const member = detail.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );
      await api.removeTeamMember(team.id, member.id);

      await new Promise((r) => setTimeout(r, 500));

      const activity = await api.getTeamActivity(team.id);
      const removeEntry = activity.entries.find(
        (e: { action: string }) => e.action === "member.removed",
      );
      expect(removeEntry).toBeTruthy();
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("changing a role logs member.role_changed activity", async ({
    api,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("ActivityRole"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "editor");

      const detail = await api.getTeam(team.id);
      const member = detail.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );
      await api.updateTeamMemberRole(team.id, member.id, "viewer");

      await new Promise((r) => setTimeout(r, 500));

      const activity = await api.getTeamActivity(team.id);
      const roleEntry = activity.entries.find(
        (e: { action: string }) => e.action === "member.role_changed",
      );
      expect(roleEntry).toBeTruthy();
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("activity log pagination works", async ({ api, secondUser }) => {
    const team = await api.createTeam(uniqueTeamName("ActivityPage"));
    try {
      // Generate multiple activities
      await api.addTeamMember(team.id, secondUser.email, "editor");

      const detail = await api.getTeam(team.id);
      const member = detail.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );
      await api.updateTeamMemberRole(team.id, member.id, "viewer");
      await api.updateTeamMemberRole(team.id, member.id, "editor");

      await new Promise((r) => setTimeout(r, 500));

      // Fetch with limit=1
      const limited = await api.getTeamActivity(team.id, 1);
      expect(limited.entries.length).toBe(1);
      expect(limited.total).toBeGreaterThanOrEqual(3);

      // Fetch all
      const all = await api.getTeamActivity(team.id, 50);
      expect(all.entries.length).toBeGreaterThanOrEqual(3);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("activity entries contain actor email and action", async ({
    api,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("ActivityFields"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "viewer");
      await new Promise((r) => setTimeout(r, 500));

      const activity = await api.getTeamActivity(team.id);
      expect(activity.entries.length).toBeGreaterThanOrEqual(1);

      const entry = activity.entries[0];
      expect(entry.actorEmail).toBeTruthy();
      expect(entry.action).toBeTruthy();
      expect(entry.createdAt).toBeTruthy();
      expect(entry.id).toBeTruthy();
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("non-member cannot access activity log", async ({
    api,
    secondApi,
  }) => {
    const team = await api.createTeam(uniqueTeamName("ActivityForbid"));
    try {
      const res = await secondApi.rawGet(
        `/api/teams/${team.id}/activity?limit=10`,
      );
      expect(res.status()).toBe(403);
    } finally {
      await api.deleteTeam(team.id);
    }
  });
});
