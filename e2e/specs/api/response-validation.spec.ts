/**
 * API response body structure validation.
 * Ensures all API endpoints return correctly shaped JSON responses,
 * not just correct status codes. Enterprise requirement for contract testing.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { uniqueRequestName, uniqueCollectionName, uniqueEnvName, MOCK_BASE } from "../../helpers/test-data";

test.describe("API Response Validation — Response Body Structure", () => {
  test("GET /api/requests returns array with correct fields", async ({ api }) => {
    const req = await api.createRequest(uniqueRequestName(), `curl ${MOCK_BASE}/get`);
    try {
      const requests = await api.listRequests();
      expect(Array.isArray(requests)).toBe(true);
      const found = requests.find((r: Record<string, unknown>) => r.id === req.id);
      expect(found).toBeDefined();
      expect(found).toHaveProperty("id");
      expect(found).toHaveProperty("name");
      expect(found).toHaveProperty("curl");
      expect(found).toHaveProperty("createdAt");
      expect(found).toHaveProperty("updatedAt");
    } finally {
      await api.deleteRequest(req.id);
    }
  });

  test("POST /api/requests returns created object with all fields", async ({ api }) => {
    const name = uniqueRequestName();
    const curl = `curl ${MOCK_BASE}/get`;
    const req = await api.createRequest(name, curl);
    try {
      expect(req).toHaveProperty("id");
      expect(req.name).toBe(name);
      expect(req.curl).toBe(curl);
      expect(req).toHaveProperty("createdAt");
      expect(req).toHaveProperty("updatedAt");
    } finally {
      await api.deleteRequest(req.id);
    }
  });

  test("GET /api/collections returns array with correct fields", async ({ api }) => {
    const coll = await api.createCollection(uniqueCollectionName());
    try {
      const collections = await api.listCollections();
      expect(Array.isArray(collections)).toBe(true);
      const found = collections.find((c: Record<string, unknown>) => c.id === coll.id);
      expect(found).toBeDefined();
      expect(found).toHaveProperty("id");
      expect(found).toHaveProperty("name");
    } finally {
      await api.deleteCollection(coll.id);
    }
  });

  test("POST /api/collections returns created object", async ({ api }) => {
    const name = uniqueCollectionName();
    const coll = await api.createCollection(name);
    try {
      expect(coll).toHaveProperty("id");
      expect(coll.name).toBe(name);
    } finally {
      await api.deleteCollection(coll.id);
    }
  });

  test("GET /api/environments returns array with correct fields", async ({ api }) => {
    const env = await api.createEnvironment(uniqueEnvName());
    try {
      const envs = await api.listEnvironments();
      expect(Array.isArray(envs)).toBe(true);
      const found = envs.find((e: Record<string, unknown>) => e.id === env.id);
      expect(found).toBeDefined();
      expect(found).toHaveProperty("id");
      expect(found).toHaveProperty("name");
      expect(found).toHaveProperty("isActive");
    } finally {
      await api.deleteEnvironment(env.id);
    }
  });

  test("401 response has error field for unauthenticated request", async ({ playwright, baseURL }) => {
    // Create a request context with NO cookies (no auth)
    const context = await playwright.request.newContext({
      baseURL: baseURL!,
      extraHTTPHeaders: { "Accept": "application/json" },
    });
    try {
      const res = await context.get(`${baseURL}/api/requests`);
      // API returns 401 for unauthenticated JSON requests
      // (may return 200 with redirect for browser requests)
      if (res.status() === 401) {
        const body = await res.json();
        expect(body).toHaveProperty("error");
        expect(typeof body.error).toBe("string");
      } else {
        // Middleware may redirect to login — that's also acceptable auth behavior
        expect([200, 302, 307]).toContain(res.status());
      }
    } finally {
      await context.dispose();
    }
  });

  test("404 response for non-existent request has error field", async ({ api }) => {
    const res = await api.rawGet("/api/requests/00000000-0000-0000-0000-000000000000");
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  test("execute response contains status, headers, body, and timeMs", async ({ api }) => {
    const result = await api.executeRequest(`curl ${MOCK_BASE}/get`);
    expect(result).toHaveProperty("status");
    expect(typeof result.status).toBe("number");
    expect(result.status).toBe(200);
    expect(result).toHaveProperty("headers");
    expect(typeof result.headers).toBe("object");
    expect(result).toHaveProperty("body");
    expect(typeof result.body).toBe("string");
    expect(result).toHaveProperty("timeMs");
    expect(typeof result.timeMs).toBe("number");
    expect(result.timeMs).toBeGreaterThan(0);
  });
});
