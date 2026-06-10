/**
 * Security regression tests: curl sanitizer file-read and flag blocking.
 * Verifies that recently patched vulnerabilities remain fixed.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("Curl Sanitizer — File Read & Flag Blocking", () => {
  test("blocks -d @/etc/passwd (arbitrary file read via data flag)", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl -d @/etc/passwd ${MOCK_BASE}/post`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/file reference|not allowed|@/i);
  });

  test("blocks --data @/tmp/secrets (long form data file read)", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl --data @/tmp/secrets ${MOCK_BASE}/post`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/file reference|not allowed|@/i);
  });

  test("blocks --data-raw @file", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl --data-raw @/tmp/secret ${MOCK_BASE}/post`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/file reference|not allowed|@/i);
  });

  test("blocks --data-binary @file", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl --data-binary @/etc/passwd ${MOCK_BASE}/post`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/file reference|not allowed|@/i);
  });

  test("blocks --data=@file (equals syntax)", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl --data=@/etc/passwd ${MOCK_BASE}/post`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/file reference|not allowed|@/i);
  });

  test("blocks -b /etc/cookies (cookie file read)", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl -b /tmp/cookies.txt ${MOCK_BASE}/get`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/cookie|file|not allowed/i);
  });

  test("allows -b session=abc123 (inline cookie key=value pair)", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl -b "session=abc123" ${MOCK_BASE}/get`);
    // Should not be blocked — inline cookie is valid
    expect(res.status()).not.toBe(422);
  });

  test("blocks -o /tmp/output (disallowed output flag)", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl -o /tmp/output ${MOCK_BASE}/get`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/not allowed|flag/i);
  });

  test("blocks -D /tmp/headers (dump headers to file)", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl -D /tmp/headers ${MOCK_BASE}/get`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/not allowed|flag/i);
  });

  test("blocks -F with file reference outside upload dir", async ({ api }) => {
    const res = await api.executeRequestRaw(`curl -F "file=@/etc/passwd" ${MOCK_BASE}/post`);
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/upload|file|path|not allowed/i);
  });
});
