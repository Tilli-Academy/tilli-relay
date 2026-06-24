/**
 * Security regression tests: IDOR (Insecure Direct Object Reference) protection.
 * Verifies that users cannot access/modify other users' resources.
 * Uses cross-worker API fixture (secondApi) for cross-user testing.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { uniqueRequestName, uniqueEnvName } from "../../helpers/test-data";

test.describe("IDOR Protection — Cross-User Resource Isolation", () => {
  test("cannot read another user's request by ID", async ({ api, secondApi }) => {
    const name = uniqueRequestName("IDOR");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");
    try {
      const res = await secondApi.rawGet(`/api/requests/${req.id}`);
      expect(res.status()).toBe(404);
    } finally {
      await api.deleteRequest(req.id);
    }
  });

  test("cannot update another user's request", async ({ api, secondApi }) => {
    const name = uniqueRequestName("IDOR");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");
    try {
      const res = await secondApi.rawPut(`/api/requests/${req.id}`, {
        name: "Hacked",
        curl: "curl https://evil.com",
      });
      expect(res.status()).toBe(404);
    } finally {
      await api.deleteRequest(req.id);
    }
  });

  test("cannot delete another user's request", async ({ api, secondApi }) => {
    const name = uniqueRequestName("IDOR");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");
    try {
      const res = await secondApi.rawDelete(`/api/requests/${req.id}`);
      expect(res.status()).toBe(404);
      // Verify original still exists
      const check = await api.rawGet(`/api/requests/${req.id}`);
      expect(check.status()).toBe(200);
    } finally {
      await api.deleteRequest(req.id);
    }
  });

  test("cannot create variable in another user's environment", async ({ api, secondApi }) => {
    const envName = uniqueEnvName("IDOR");
    const env = await api.createEnvironment(envName);
    try {
      const res = await secondApi.rawPost("/api/variables", {
        key: "STOLEN",
        value: "hacked",
        environmentId: env.id,
      });
      // Should be 403 (access denied) or 404 (env not found for that user)
      expect([403, 404]).toContain(res.status());
    } finally {
      await api.deleteEnvironment(env.id);
    }
  });

  test("cannot delete another user's variable", async ({ api, secondApi }) => {
    const envName = uniqueEnvName("IDOR");
    const env = await api.createEnvironment(envName);
    const variable = await api.createVariable("SECRET_KEY", "secret123", env.id);
    try {
      const res = await secondApi.rawDelete(`/api/variables/${variable.id}`);
      expect(res.status()).toBe(404);
    } finally {
      await api.deleteVariable(variable.id);
      await api.deleteEnvironment(env.id);
    }
  });

  test("cannot read another user's environment", async ({ api, secondApi }) => {
    const envName = uniqueEnvName("IDOR");
    const env = await api.createEnvironment(envName);
    try {
      const res = await secondApi.rawGet(`/api/environments/${env.id}`);
      // environments/[id] only exposes PUT and DELETE — GET returns 405 Method Not Allowed
      // 403, 404, or 405 are all acceptable for IDOR protection
      expect([403, 404, 405]).toContain(res.status());
    } finally {
      await api.deleteEnvironment(env.id);
    }
  });

  test("cannot list another user's history entries", async ({ api, secondApi }) => {
    // Worker 0 creates a history entry directly
    await api.clearHistory();
    await secondApi.clearHistory();
    await api.createHistoryEntry({
      method: "GET",
      url: "https://httpbin.org/get",
      curl: "curl https://httpbin.org/get",
      statusCode: 200,
      timeMs: 100,
    });

    // Verify worker 0 has at least one history entry
    const firstHistory = await api.getHistory();
    const firstEntries = Array.isArray(firstHistory) ? firstHistory : [];
    expect(firstEntries.length).toBeGreaterThanOrEqual(1);

    // Worker 1 should not see worker 0's history entries
    const secondHistory = await secondApi.getHistory();
    const secondEntries = Array.isArray(secondHistory) ? secondHistory : [];
    expect(secondEntries.length).toBe(0);
  });

  test("cannot access another user's collections", async ({ api, secondApi }) => {
    const coll = await api.createCollection("IDOR Collection");
    try {
      const res = await secondApi.rawGet(`/api/collections/${coll.id}`);
      expect(res.status()).toBe(404);
    } finally {
      await api.deleteCollection(coll.id);
    }
  });
});
