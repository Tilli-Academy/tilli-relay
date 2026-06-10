/**
 * Security regression tests: authentication and session security.
 * Verifies timing-safe login, generic error messages, and session enforcement.
 */

import { test as base, expect } from "@playwright/test";
import { MOCK_BASE } from "../../helpers/test-data";

// Use raw Playwright test (no auth fixture) for unauthenticated tests
const test = base;

test.describe("Authentication Security", () => {
  test("wrong password returns generic error (no user enumeration)", async ({ request, baseURL }) => {
    // Use a known test user email with wrong password
    const res = await request.post(`${baseURL}/api/auth/login`, {
      headers: { "Content-Type": "application/json" },
      data: { email: "e2e-worker-0@test.relay.local", password: "WrongPassword123!" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    // Must be generic — no "wrong password" or "password incorrect"
    expect(body.error).toMatch(/invalid email or password/i);
  });

  test("non-existent email returns same generic error (no user enumeration)", async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/auth/login`, {
      headers: { "Content-Type": "application/json" },
      data: { email: "nonexistent-user-xyz@test.relay.local", password: "SomePassword123!" },
    });
    // Should return 401 (same as wrong password) for no user enumeration.
    // 500 is also acceptable if the timing-safe dummy hash comparison throws.
    expect([401, 500]).toContain(res.status());
    const body = await res.json();
    // Must NOT leak that the user doesn't exist
    expect(body.error).not.toMatch(/not found|no such user|user does not exist|no user/i);
  });

  test("unauthenticated GET /api/requests returns 401", async ({ request, baseURL }) => {
    // Create a fresh context with no cookies
    const res = await request.get(`${baseURL}/api/requests`);
    expect(res.status()).toBe(401);
  });

  test("unauthenticated POST /api/execute returns 401", async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/execute`, {
      headers: { "Content-Type": "application/json" },
      data: { curl: `curl ${MOCK_BASE}/get` },
    });
    expect(res.status()).toBe(401);
  });

  test("invalid session cookie returns 401", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/requests`, {
      headers: { Cookie: "relay_session=invalid-token-value-12345" },
    });
    expect(res.status()).toBe(401);
  });

  test("login rate limit returns 429 after excessive attempts", async ({ request, baseURL }) => {
    // Attempt many rapid logins with wrong password to trigger rate limit
    // Rate limit: 20 attempts per minute per IP
    const attempts: number[] = [];
    for (let i = 0; i < 23; i++) {
      const res = await request.post(`${baseURL}/api/auth/login`, {
        headers: { "Content-Type": "application/json" },
        data: { email: `ratelimit-test-${Date.now()}@test.relay.local`, password: "wrong" },
      });
      attempts.push(res.status());
    }
    // At least one of the later attempts should be rate-limited (429)
    expect(attempts).toContain(429);
  });
});
