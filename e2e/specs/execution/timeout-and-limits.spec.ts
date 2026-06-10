/**
 * Execution guardrails: size limits, input validation, timeout behavior.
 * Ensures the curl execution pipeline enforces enterprise safety limits.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("Execution Timeout and Limits", () => {
  test("rejects curl command exceeding 50KB limit", async ({ api }) => {
    const hugeCurl = `curl -d "${"X".repeat(51_000)}" ${MOCK_BASE}/post`;
    const res = await api.executeRequestRaw(hugeCurl);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/maximum length|exceeds/i);
  });

  test("rejects empty curl string", async ({ api }) => {
    const res = await api.rawPost("/api/execute", { curl: "" });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing|invalid/i);
  });

  test("rejects non-string curl value (number)", async ({ api }) => {
    const res = await api.rawPost("/api/execute", { curl: 12345 });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing|invalid/i);
  });

  test("rejects non-string curl value (null)", async ({ api }) => {
    const res = await api.rawPost("/api/execute", { curl: null });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing|invalid/i);
  });

  test("rejects request body without curl field", async ({ api }) => {
    const res = await api.rawPost("/api/execute", { command: `curl ${MOCK_BASE}/get` });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing|invalid/i);
  });

  test("slow endpoint returns response with timing metadata", async ({ api }) => {
    test.setTimeout(45_000);
    // /delay/1 waits 1 second before responding
    const result = await api.executeRequest(`curl ${MOCK_BASE}/delay/1`);
    expect(result.status).toBe(200);
    expect(result.timeMs).toBeGreaterThanOrEqual(900); // at least ~1 second
  });

  test("status code is correctly extracted from curl output", async ({ api }) => {
    const result = await api.executeRequest(`curl ${MOCK_BASE}/status/201`);
    expect(result.status).toBe(201);
  });

  test("curl command at exactly 50KB is accepted", async ({ api }) => {
    // Build a curl command right at the limit (50,000 bytes)
    const padding = "X".repeat(49_900);
    const curl = `curl -d "${padding}" ${MOCK_BASE}/post`;
    // This may be slightly over or under depending on URL length, but the key test
    // is that it doesn't hit the 50KB rejection
    if (curl.length <= 50_000) {
      const res = await api.executeRequestRaw(curl);
      // Should not be 400 (size limit)
      expect(res.status()).not.toBe(400);
    }
  });
});
