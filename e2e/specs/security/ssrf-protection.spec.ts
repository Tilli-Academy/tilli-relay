/**
 * Security regression tests: SSRF protection.
 * Verifies that server-side curl execution blocks private/internal IPs.
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
