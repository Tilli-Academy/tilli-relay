/**
 * Team RBAC (Role-Based Access Control) e2e tests.
 * Uses cross-worker API fixture to test permission enforcement.
 * Worker A creates team and adds Worker B as viewer/editor,
 * then tests are run from Worker B's context.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { uniqueTeamName } from "../../helpers/test-data";

test.describe("Team RBAC", () => {
  test("viewer cannot update team name", async ({
    api,
    secondApi,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("RBAC-V"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "viewer");

      const res = await secondApi.updateTeam(team.id, "Hacked Name");
      expect(res.status()).toBe(403);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("viewer cannot delete team", async ({
    api,
    secondApi,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("RBAC-VDel"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "viewer");

      const res = await secondApi.deleteTeam(team.id);
      expect(res.status()).toBe(403);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("viewer cannot add members", async ({
    api,
    secondApi,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("RBAC-VAdd"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "viewer");

      const res = await secondApi.addTeamMember(
        team.id,
        "someone@example.com",
        "editor",
      );
      expect(res.status()).toBe(403);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("viewer cannot remove members", async ({
    api,
    secondApi,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("RBAC-VRem"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "viewer");

      // Get the owner's member ID
      const detail = await api.getTeam(team.id);
      const owner = detail.members.find(
        (m: { role: string }) => m.role === "owner",
      );

      const res = await secondApi.removeTeamMember(team.id, owner.id);
      expect(res.status()).toBe(403);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("editor cannot delete team", async ({
    api,
    secondApi,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("RBAC-EDel"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "editor");

      const res = await secondApi.deleteTeam(team.id);
      expect(res.status()).toBe(403);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("editor cannot add members", async ({
    api,
    secondApi,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("RBAC-EAdd"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "editor");

      const res = await secondApi.addTeamMember(
        team.id,
        "another@example.com",
        "viewer",
      );
      expect(res.status()).toBe(403);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("non-member cannot access team details", async ({
    api,
    secondApi,
  }) => {
    const team = await api.createTeam(uniqueTeamName("RBAC-NonMem"));
    try {
      // secondApi user is NOT added as a member
      const res = await secondApi.rawGet(`/api/teams/${team.id}`);
      expect(res.status()).toBe(403);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("viewer can read team details and members", async ({
    api,
    secondApi,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("RBAC-VRead"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "viewer");

      const detail = await secondApi.getTeam(team.id);
      expect(detail.id).toBe(team.id);
      expect(detail.name).toBeTruthy();
      expect(Array.isArray(detail.members)).toBe(true);
      expect(detail.members.length).toBeGreaterThanOrEqual(2);
    } finally {
      await api.deleteTeam(team.id);
    }
  });
});
