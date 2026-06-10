/**
 * Sharing API tests: create, list, resolve, revoke share links.
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { uniqueRequestName } from "../../helpers/test-data";

test.describe("Share Links — CRUD", () => {
  let requestId: string;

  test.beforeEach(async ({ api }) => {
    const name = uniqueRequestName("Share");
    const req = await api.createRequest(name, "curl https://httpbin.org/get");
    requestId = req.id;
  });

  test.afterEach(async ({ api }) => {
    if (requestId) {
      await api.deleteRequest(requestId).catch(() => {});
    }
  });

  test("creates share link for saved request", async ({ api }) => {
    const res = await api.createShareLink(requestId);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.id).toBeTruthy();
    // Cleanup
    await api.revokeShareLink(body.token);
  });

  test("lists share links for a request", async ({ api }) => {
    const res1 = await api.createShareLink(requestId);
    const link1 = await res1.json();
    const res2 = await api.createShareLink(requestId);
    const link2 = await res2.json();

    const links = await api.listShareLinks(requestId);
    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBeGreaterThanOrEqual(2);

    // Cleanup
    await api.revokeShareLink(link1.token);
    await api.revokeShareLink(link2.token);
  });

  test("resolves share link publicly without authentication", async ({ api, playwright, baseURL }) => {
    const res = await api.createShareLink(requestId);
    const { token } = await res.json();

    // Use unauthenticated context
    const unauthCtx = await playwright.request.newContext({ baseURL: baseURL! });
    try {
      const publicRes = await unauthCtx.get(`${baseURL}/api/share/${token}`);
      expect(publicRes.status()).toBe(200);
      const body = await publicRes.json();
      expect(body.name).toBeTruthy();
      expect(body.curl).toContain("curl");
    } finally {
      await unauthCtx.dispose();
      await api.revokeShareLink(token);
    }
  });

  test("resolved share link contains correct request data", async ({ api }) => {
    const res = await api.createShareLink(requestId);
    const { token } = await res.json();

    const publicRes = await api.resolveShareLink(token);
    expect(publicRes.status()).toBe(200);
    const body = await publicRes.json();
    expect(body.curl).toContain("httpbin.org/get");
    expect(body.method).toBe("GET");
    expect(body.url).toContain("httpbin.org");

    await api.revokeShareLink(token);
  });

  test("revokes share link — subsequent resolve returns 404", async ({ api }) => {
    const res = await api.createShareLink(requestId);
    const { token } = await res.json();

    const revokeRes = await api.revokeShareLink(token);
    expect(revokeRes.status()).toBe(200);

    const resolveRes = await api.resolveShareLink(token);
    expect(resolveRes.status()).toBe(404);
  });

  test("share link with expiration has expiresAt metadata", async ({ api }) => {
    const res = await api.createShareLink(requestId, 24);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.expiresAt).toBeTruthy();

    const links = await api.listShareLinks(requestId);
    const link = links.find((l: { token: string }) => l.token === body.token);
    expect(link).toBeTruthy();
    expect(link.expiresAt).toBeTruthy();

    await api.revokeShareLink(body.token);
  });

  test("cannot share request you don't own", async ({ api, secondApi }) => {
    // secondApi (different user) tries to share worker 0's request
    const res = await secondApi.createShareLink(requestId);
    expect(res.status()).toBe(404);
  });

  test("cannot share non-existent request", async ({ api }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await api.createShareLink(fakeId);
    expect(res.status()).toBe(404);
  });

  test("revoking already-revoked link returns 404", async ({ api }) => {
    const res = await api.createShareLink(requestId);
    const { token } = await res.json();

    await api.revokeShareLink(token);
    const secondRevoke = await api.revokeShareLink(token);
    expect(secondRevoke.status()).toBe(404);
  });

  test("multiple share links for same request all resolve independently", async ({ api }) => {
    const res1 = await api.createShareLink(requestId);
    const link1 = await res1.json();
    const res2 = await api.createShareLink(requestId);
    const link2 = await res2.json();

    // Both should resolve
    const resolve1 = await api.resolveShareLink(link1.token);
    expect(resolve1.status()).toBe(200);
    const resolve2 = await api.resolveShareLink(link2.token);
    expect(resolve2.status()).toBe(200);

    // Revoke one — the other should still work
    await api.revokeShareLink(link1.token);
    const afterRevoke = await api.resolveShareLink(link2.token);
    expect(afterRevoke.status()).toBe(200);

    await api.revokeShareLink(link2.token);
  });
});
