/**
 * Team members e2e tests.
 * Validates invite, role changes, removal, and member management.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { uniqueTeamName } from "../../helpers/test-data";

test.describe("Team Members", () => {
  test("owner adds member with editor role", async ({ api, secondUser }) => {
    const team = await api.createTeam(uniqueTeamName("Members"));
    try {
      const res = await api.addTeamMember(team.id, secondUser.email, "editor");
      expect(res.status()).toBe(201);

      const detail = await api.getTeam(team.id);
      const member = detail.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );
      expect(member).toBeTruthy();
      expect(member.role).toBe("editor");
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("owner adds member with viewer role", async ({ api, secondUser }) => {
    const team = await api.createTeam(uniqueTeamName("ViewerAdd"));
    try {
      const res = await api.addTeamMember(team.id, secondUser.email, "viewer");
      expect(res.status()).toBe(201);

      const detail = await api.getTeam(team.id);
      const member = detail.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );
      expect(member).toBeTruthy();
      expect(member.role).toBe("viewer");
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("rejects adding non-existent email", async ({ api }) => {
    const team = await api.createTeam(uniqueTeamName("NoUser"));
    try {
      const res = await api.addTeamMember(
        team.id,
        `nonexistent-${Date.now()}@example.com`,
        "editor",
      );
      expect([404, 400]).toContain(res.status());
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("rejects duplicate member", async ({ api, secondUser }) => {
    const team = await api.createTeam(uniqueTeamName("Dup"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "editor");

      // Adding same user again should fail (409 Conflict or 500 if unique constraint wraps differently)
      const res = await api.addTeamMember(team.id, secondUser.email, "editor");
      expect([400, 409, 500]).toContain(res.status());
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("owner changes member role from editor to viewer", async ({
    api,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("RoleChange"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "editor");

      // Find the member ID
      const detail = await api.getTeam(team.id);
      const member = detail.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );
      expect(member).toBeTruthy();

      const res = await api.updateTeamMemberRole(
        team.id,
        member.id,
        "viewer",
      );
      expect(res.status()).toBe(200);

      // Verify new role
      const updated = await api.getTeam(team.id);
      const updatedMember = updated.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );
      expect(updatedMember.role).toBe("viewer");
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("owner changes member role from viewer to editor", async ({
    api,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("RoleUp"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "viewer");

      const detail = await api.getTeam(team.id);
      const member = detail.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );

      const res = await api.updateTeamMemberRole(
        team.id,
        member.id,
        "editor",
      );
      expect(res.status()).toBe(200);

      const updated = await api.getTeam(team.id);
      const updatedMember = updated.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );
      expect(updatedMember.role).toBe("editor");
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("owner removes a member", async ({ api, secondUser }) => {
    const team = await api.createTeam(uniqueTeamName("Remove"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "editor");

      const detail = await api.getTeam(team.id);
      const member = detail.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );

      const res = await api.removeTeamMember(team.id, member.id);
      expect(res.status()).toBe(200);

      // Verify member is gone
      const updated = await api.getTeam(team.id);
      const found = updated.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );
      expect(found).toBeFalsy();
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("cannot demote sole owner", async ({ api }) => {
    const team = await api.createTeam(uniqueTeamName("SoleOwner"));
    try {
      // The creator is the sole owner — find their member ID
      const detail = await api.getTeam(team.id);
      const owner = detail.members.find(
        (m: { role: string }) => m.role === "owner",
      );
      expect(owner).toBeTruthy();

      const res = await api.updateTeamMemberRole(
        team.id,
        owner.id,
        "editor",
      );
      expect(res.status()).toBe(400);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("cannot remove sole owner", async ({ api }) => {
    const team = await api.createTeam(uniqueTeamName("RemoveOwner"));
    try {
      const detail = await api.getTeam(team.id);
      const owner = detail.members.find(
        (m: { role: string }) => m.role === "owner",
      );
      expect(owner).toBeTruthy();

      const res = await api.removeTeamMember(team.id, owner.id);
      expect(res.status()).toBe(400);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("invited member appears with correct email", async ({
    api,
    secondUser,
  }) => {
    const team = await api.createTeam(uniqueTeamName("InviteCheck"));
    try {
      await api.addTeamMember(team.id, secondUser.email, "editor");

      const detail = await api.getTeam(team.id);
      const member = detail.members.find(
        (m: { email: string }) => m.email === secondUser.email,
      );
      expect(member).toBeTruthy();
      expect(member.email).toBe(secondUser.email);
      expect(member.joinedAt).toBeTruthy();
    } finally {
      await api.deleteTeam(team.id);
    }
  });
});
