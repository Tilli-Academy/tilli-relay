/**
 * Security regression tests: SSRF protection.
 * Verifies that server-side curl execution blocks private/internal IPs,
 * blocks redirect-based SSRF (-L to internal IPs), and pins DNS to
 * prevent TOCTOU / DNS rebinding attacks.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("SSRF Protection — Private IP Blocking", () => {
  // Skipped in e2e: RELAY_E2E_ALLOW_LOCAL=true exempts 127.0.0.1 for mock server.
  // The SSRF block for 127.0.0.1 is verified in unit tests instead.
  test.skip("blocks curl to 127.0.0.1 (localhost)", async ({ api }) => {
    const res = await api.executeRequestRaw("curl http://127.0.0.1/admin");
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/private|internal|blocked|SSRF|loopback/i);
  });

  test("blocks curl to 0.0.0.0", async ({ api }) => {
    const res = await api.executeRequestRaw("curl http://0.0.0.0/");
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/private|internal|blocked|SSRF/i);
  });

  test("blocks curl to 10.0.0.1 (private class A)", async ({ api }) => {
    const res = await api.executeRequestRaw("curl http://10.0.0.1/internal");
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/private|internal|blocked|SSRF/i);
  });

  test("blocks curl to 172.16.0.1 (private class B)", async ({ api }) => {
    const res = await api.executeRequestRaw("curl http://172.16.0.1/");
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/private|internal|blocked|SSRF/i);
  });

  test("blocks curl to 192.168.1.1 (private class C)", async ({ api }) => {
    const res = await api.executeRequestRaw("curl http://192.168.1.1/router");
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/private|internal|blocked|SSRF/i);
  });

  test("blocks curl to 169.254.169.254 (cloud metadata endpoint)", async ({ api }) => {
    const res = await api.executeRequestRaw("curl http://169.254.169.254/latest/meta-data/");
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/private|internal|blocked|SSRF|metadata/i);
  });

  test("blocks curl to [::1] (IPv6 loopback)", async ({ api }) => {
    const res = await api.executeRequestRaw("curl http://[::1]/admin");
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/private|internal|blocked|SSRF|loopback/i);
  });

  test("allows curl to legitimate public host", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl ${MOCK_BASE}/get`);
    // Should succeed — public host is allowed
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(200);
  });
});

test.describe("SSRF Protection — Redirect Re-validation", () => {
  test("blocks -L redirect to cloud metadata IP (169.254.169.254)", async ({ api }) => {
    // Mock server returns 302 → http://169.254.169.254/latest/meta-data/
    const res = await api.executeRequestRaw(`curl -L ${MOCK_BASE}/ssrf/redirect-to-metadata`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/redirect blocked.*private|internal/i);
  });

  test("blocks -L redirect to private IP (10.0.0.1)", async ({ api }) => {
    // Mock server returns 302 → http://10.0.0.1/internal
    const res = await api.executeRequestRaw(`curl -L ${MOCK_BASE}/ssrf/redirect-to-private`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/redirect blocked.*private|internal/i);
  });

  test("blocks -L redirect to file:// protocol", async ({ api }) => {
    // Mock server returns 302 → file:///etc/passwd
    const res = await api.executeRequestRaw(`curl -L ${MOCK_BASE}/ssrf/redirect-to-file`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/disallowed protocol/i);
  });

  test("allows -L redirect to safe host (same mock server)", async ({ api }) => {
    // /redirect/1 → 302 to /get (relative, same localhost mock server)
    const res = await api.executeRequestRaw(`curl -L ${MOCK_BASE}/redirect/1`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // The final response should be from /get with status 200
    expect(body.status).toBe(200);
  });

  test("returns 302 without following when -L is absent", async ({ api }) => {
    // Without -L, curl returns the redirect response directly
    const res = await api.executeRequestRaw(`curl ${MOCK_BASE}/redirect/1`);
    expect(res.status()).toBe(200); // API itself returns 200; body contains the curl result
    const body = await res.json();
    expect(body.status).toBe(302);
  });

  test("allows multi-hop safe redirects with -L", async ({ api }) => {
    // /redirect/3 → /redirect/2 → /redirect/1 → /get — all on same mock server
    const res = await api.executeRequestRaw(`curl -L ${MOCK_BASE}/redirect/3`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(200);
  });
});
