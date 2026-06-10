/**
 * Team data isolation: verifies that resources are scoped to workspaces.
 * Enterprise requirement: data created in one workspace must not leak to another.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import {
  uniqueTeamName,
  uniqueRequestName,
  uniqueCollectionName,
  uniqueEnvName,
  uniqueFolderName,
} from "../../helpers/test-data";

test.describe("Team Data Isolation", () => {
  test("personal requests are not visible in team workspace", async ({ api }) => {
    const teamName = uniqueTeamName("Iso");
    const team = await api.createTeam(teamName);
    const reqName = uniqueRequestName("Personal");

    try {
      // Create request in personal workspace (no team header)
      const req = await api.createRequest(reqName, "curl https://httpbin.org/get");

      // List requests in team workspace
      const teamRequests = await api.listRequestsInTeam(team.id);
      const found = Array.isArray(teamRequests)
        ? teamRequests.find((r: Record<string, unknown>) => r.id === req.id)
        : undefined;
      expect(found).toBeUndefined();

      await api.deleteRequest(req.id);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("team requests are not visible in personal workspace", async ({ api }) => {
    const teamName = uniqueTeamName("Iso");
    const team = await api.createTeam(teamName);
    const reqName = uniqueRequestName("TeamOnly");

    try {
      // Create request in team workspace
      const req = await api.createRequestInTeam(team.id, reqName, "curl https://httpbin.org/get");

      // List requests in personal workspace (no team header)
      const personalRequests = await api.listRequests();
      const found = Array.isArray(personalRequests)
        ? personalRequests.find((r: Record<string, unknown>) => r.id === req.id)
        : undefined;
      expect(found).toBeUndefined();
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("personal collections are not visible in team workspace", async ({ api }) => {
    const teamName = uniqueTeamName("Iso");
    const team = await api.createTeam(teamName);
    const collName = uniqueCollectionName("Personal");

    try {
      // Create collection in personal workspace
      const coll = await api.createCollection(collName);

      // List collections in team workspace
      const teamCollections = await api.listCollectionsInTeam(team.id);
      const found = Array.isArray(teamCollections)
        ? teamCollections.find((c: Record<string, unknown>) => c.id === coll.id)
        : undefined;
      expect(found).toBeUndefined();

      await api.deleteCollection(coll.id);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("personal environments are not visible in team workspace", async ({ api }) => {
    const teamName = uniqueTeamName("Iso");
    const team = await api.createTeam(teamName);
    const envName = uniqueEnvName("Personal");

    try {
      // Create environment in personal workspace
      const env = await api.createEnvironment(envName);

      // List environments in team workspace
      const teamEnvs = await api.listEnvironmentsInTeam(team.id);
      const found = Array.isArray(teamEnvs)
        ? teamEnvs.find((e: Record<string, unknown>) => e.id === env.id)
        : undefined;
      expect(found).toBeUndefined();

      await api.deleteEnvironment(env.id);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("personal folders are not visible in team workspace", async ({ api }) => {
    const teamName = uniqueTeamName("Iso");
    const team = await api.createTeam(teamName);
    const folderName = uniqueFolderName("Personal");

    try {
      // Create folder in personal workspace
      const folder = await api.createFolder(folderName);

      // List folders in team workspace
      const teamFolders = await api.listFoldersInTeam(team.id);
      const found = Array.isArray(teamFolders)
        ? teamFolders.find((f: Record<string, unknown>) => f.id === folder.id)
        : undefined;
      expect(found).toBeUndefined();

      await api.deleteFolder(folder.id);
    } finally {
      await api.deleteTeam(team.id);
    }
  });

  test("team-created resources are scoped to that team only", async ({ api }) => {
    const team1Name = uniqueTeamName("TeamA");
    const team2Name = uniqueTeamName("TeamB");
    const team1 = await api.createTeam(team1Name);
    const team2 = await api.createTeam(team2Name);

    try {
      // Create a request in team1
      const reqName = uniqueRequestName("Team1Only");
      const req = await api.createRequestInTeam(team1.id, reqName, "curl https://httpbin.org/get");

      // Should NOT be visible in team2
      const team2Requests = await api.listRequestsInTeam(team2.id);
      const found = Array.isArray(team2Requests)
        ? team2Requests.find((r: Record<string, unknown>) => r.id === req.id)
        : undefined;
      expect(found).toBeUndefined();

      // Should be visible in team1
      const team1Requests = await api.listRequestsInTeam(team1.id);
      const foundInTeam1 = Array.isArray(team1Requests)
        ? team1Requests.find((r: Record<string, unknown>) => r.id === req.id)
        : undefined;
      expect(foundInTeam1).toBeDefined();
    } finally {
      await api.deleteTeam(team1.id);
      await api.deleteTeam(team2.id);
    }
  });
});
