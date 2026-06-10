/**
 * Team CRUD e2e tests.
 * Validates create, read, update, delete operations for teams via the API.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { uniqueTeamName } from "../../helpers/test-data";

test.describe("Team CRUD", () => {
  test("creates a team via API and verifies it exists", async ({ api }) => {
    const name = uniqueTeamName("CRUD");
    const team = await api.createTeam(name);
    try {
      expect(team.id).toBeTruthy();
      expect(team.name).toBe(name);

      const teams = await api.listTeams();
      const found = teams.find(
        (t: { id: string; name: string }) => t.id === team.id,
      );
      expect(found).toBeTruthy();
      expect(found.name).toBe(name);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("lists multiple teams correctly", async ({ api }) => {
    const nameA = uniqueTeamName("ListA");
    const nameB = uniqueTeamName("ListB");
    const teamA = await api.createTeam(nameA);
    const teamB = await api.createTeam(nameB);
    try {
      const teams = await api.listTeams();
      const ids = teams.map((t: { id: string }) => t.id);
      expect(ids).toContain(teamA.id);
      expect(ids).toContain(teamB.id);
    } finally {
      await api.deleteTeam(teamA.id);
      await api.deleteTeam(teamB.id);
    }
  });

  test("fetches team detail with members", async ({ api }) => {
    const name = uniqueTeamName("Detail");
    const team = await api.createTeam(name);
    try {
      const detail = await api.getTeam(team.id);
      expect(detail.id).toBe(team.id);
      expect(detail.name).toBe(name);
      expect(Array.isArray(detail.members)).toBe(true);
      expect(detail.members.length).toBeGreaterThanOrEqual(1);

      const owner = detail.members.find(
        (m: { role: string }) => m.role === "owner",
      );
      expect(owner).toBeTruthy();
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("renames team (owner)", async ({ api }) => {
    const originalName = uniqueTeamName("Rename");
    const team = await api.createTeam(originalName);
    try {
      const newName = uniqueTeamName("Renamed");
      const res = await api.updateTeam(team.id, newName);
      expect(res.status()).toBe(200);

      const detail = await api.getTeam(team.id);
      expect(detail.name).toBe(newName);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("deletes team", async ({ api }) => {
    const name = uniqueTeamName("Delete");
    const team = await api.createTeam(name);

    const res = await api.deleteTeam(team.id);
    expect(res.status()).toBe(200);

    const teams = await api.listTeams();
    const found = teams.find(
      (t: { id: string }) => t.id === team.id,
    );
    expect(found).toBeUndefined();
  });

  test("delete returns 403 or 404 for non-existent team", async ({ api }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await api.deleteTeam(fakeId);
    expect([403, 404]).toContain(res.status());
  });

  test("create team with empty name fails", async ({ api }) => {
    const res = await api.rawPost("/api/teams", { name: "" });
    expect(res.status()).toBe(400);
  });

  test("create team with very long name succeeds", async ({ api }) => {
    const longName = "A".repeat(100);
    const team = await api.createTeam(longName);
    try {
      expect(team.id).toBeTruthy();
      expect(team.name).toBe(longName);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("fetching deleted team returns 403 or 404", async ({ api }) => {
    const name = uniqueTeamName("FetchDeleted");
    const team = await api.createTeam(name);
    await api.deleteTeam(team.id);

    const res = await api.rawGet(`/api/teams/${team.id}`);
    expect([403, 404]).toContain(res.status());
  });

  test("team slug is auto-generated from name", async ({ api }) => {
    const name = "My Test Team " + Date.now();
    const team = await api.createTeam(name);
    try {
      expect(team.slug).toBeTruthy();
      expect(typeof team.slug).toBe("string");
      // Slug should be lowercase with hyphens
      expect(team.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    } finally {
      await api.deleteTeam(team.id);
    }
  });
});
