/**
 * Security regression tests: Injection prevention.
 * Verifies that the curl execution pipeline blocks various injection vectors.
 *
 * Note: shell metacharacters (;|&`$()) are harmless because execution uses
 * child_process.execFile (no shell). These tests verify the flag allowlist,
 * file-read prevention, and URL protocol enforcement.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("Injection Prevention — Curl Sanitizer", () => {
  test("blocks disallowed flag: --output (file write)", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl --output /tmp/pwned ${MOCK_BASE}/get`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/not allowed/i);
  });

  test("blocks disallowed flag: -O (remote file write)", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl -O ${MOCK_BASE}/get`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/not allowed/i);
  });

  test("blocks @file reference in data flag (arbitrary file read)", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl -d @/etc/passwd ${MOCK_BASE}/post`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/file|@|not allowed/i);
  });

  test("blocks @file reference in --data-raw flag", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl --data-raw @/etc/shadow ${MOCK_BASE}/post`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/file|@|not allowed/i);
  });

  test("blocks cookie file path (bare path without =)", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl -b /etc/passwd ${MOCK_BASE}/get`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/cookie|file|not allowed/i);
  });

  test("rejects non-http protocol (ftp://)", async ({ api }) => {
    const res = await api.executeRequestRaw("curl ftp://evil.com/file");
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/protocol|http|https/i);
  });

  test("rejects non-http protocol (file://)", async ({ api }) => {
    const res = await api.executeRequestRaw("curl file:///etc/passwd");
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/protocol|http|https/i);
  });

  test("rejects curl command exceeding 50KB length limit", async ({ api }) => {
    const longUrl = `${MOCK_BASE}/get?data=${"A".repeat(51_000)}`;
    const res = await api.executeRequestRaw(`curl ${longUrl}`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/maximum length|exceeds/i);
  });

  test("rejects command not starting with curl", async ({ api }) => {
    const res = await api.executeRequestRaw(`wget ${MOCK_BASE}/get`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/must start with.*curl/i);
  });

  test("rejects command with no URL", async ({ api }) => {
    const res = await api.executeRequestRaw("curl -H 'Accept: */*'");
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/no url/i);
  });

  test("shell metacharacters in URL are harmless (execFile, no shell)", async ({ api }) => {
    // These characters are literal argv values, not interpreted by a shell.
    // The request should either succeed or fail at the network level, not at sanitization.
    const res = await api.executeRequestRaw(`curl "${MOCK_BASE}/get?q=a;b"`);
    // Should NOT be a 422 sanitization error — the semicolon is in the URL value
    const body = await res.json();
    expect(body.status).toBe(200);
  });

  test("allows legitimate cookie key=value format", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl -b "session=abc123" ${MOCK_BASE}/get`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(200);
  });
});
