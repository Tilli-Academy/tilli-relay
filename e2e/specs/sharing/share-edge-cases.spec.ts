/**
 * Sharing edge cases: orphan shares, cross-user revocation, expiry, multiple tokens.
 * Tests data integrity and access control for the sharing system.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { uniqueRequestName } from "../../helpers/test-data";

test.describe("Sharing — Edge Cases", () => {
  test("share request, delete original, shared link returns 404 or 410", async ({ api }) => {
    const name = uniqueRequestName("Orphan");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");
    const res = await api.createShareLink(req.id);
    const { token } = await res.json();

    // Delete the original request
    await api.deleteRequest(req.id);

    // The shared link should now be invalid
    const shareRes = await api.resolveShareLink(token);
    expect([404, 410]).toContain(shareRes.status());
  });

  test("cross-user share revocation is blocked", async ({ api, secondApi }) => {
    const name = uniqueRequestName("CrossRevoke");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");
    const res = await api.createShareLink(req.id);
    const { token } = await res.json();

    try {
      // Second user tries to revoke first user's share
      const revokeRes = await secondApi.revokeShareLink(token);
      // Should be forbidden or not found
      expect([403, 404]).toContain(revokeRes.status());

      // Verify share still works for the original user
      const checkRes = await api.resolveShareLink(token);
      expect(checkRes.status()).toBe(200);
    } finally {
      await api.revokeShareLink(token);
      await api.deleteRequest(req.id);
    }
  });

  test("multiple shares of same request get unique tokens", async ({ api }) => {
    const name = uniqueRequestName("Multi");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");

    try {
      const res1 = await api.createShareLink(req.id);
      const share1 = await res1.json();
      const res2 = await api.createShareLink(req.id);
      const share2 = await res2.json();

      expect(share1.token).toBeDefined();
      expect(share2.token).toBeDefined();
      expect(share1.token).not.toBe(share2.token);

      // Both should resolve
      const check1 = await api.resolveShareLink(share1.token);
      const check2 = await api.resolveShareLink(share2.token);
      expect(check1.status()).toBe(200);
      expect(check2.status()).toBe(200);

      await api.revokeShareLink(share1.token);
      await api.revokeShareLink(share2.token);
    } finally {
      await api.deleteRequest(req.id);
    }
  });

  test("revoking one share does not affect other shares of same request", async ({ api }) => {
    const name = uniqueRequestName("Revoke");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");

    try {
      const res1 = await api.createShareLink(req.id);
      const share1 = await res1.json();
      const res2 = await api.createShareLink(req.id);
      const share2 = await res2.json();

      // Revoke first share
      await api.revokeShareLink(share1.token);

      // Second share should still work
      const check2 = await api.resolveShareLink(share2.token);
      expect(check2.status()).toBe(200);

      // First share should be gone
      const check1 = await api.resolveShareLink(share1.token);
      expect([404, 410]).toContain(check1.status());

      await api.revokeShareLink(share2.token);
    } finally {
      await api.deleteRequest(req.id);
    }
  });

  test("shared page returns request data with method, URL, and curl", async ({ api }) => {
    const name = uniqueRequestName("Data");
    const curl = "curl -X POST https://httpbin.org/post -H 'Content-Type: application/json'";
    const req = await api.createRequest(name, curl);
    const res = await api.createShareLink(req.id);
    const { token } = await res.json();

    try {
      const shareRes = await api.resolveShareLink(token);
      expect(shareRes.status()).toBe(200);
      const data = await shareRes.json();
      expect(data).toHaveProperty("name", name);
      expect(data).toHaveProperty("curl");
      expect(data.curl).toContain("POST");
      expect(data.curl).toContain("httpbin.org/post");
    } finally {
      await api.revokeShareLink(token);
      await api.deleteRequest(req.id);
    }
  });
});
