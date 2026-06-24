import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/teamAuth", () => ({
  requireTeamRole: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";
import { withAuth, withTeamAuth } from "../withAuth";

const mockGetSession = vi.mocked(getSession);
const mockRequireTeamRole = vi.mocked(requireTeamRole);

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withAuth", () => {
  it("returns 401 when session is null", async () => {
    mockGetSession.mockResolvedValue(null);

    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const res = await wrapped(makeRequest());

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes session to handler when authenticated", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1" });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);
    const req = makeRequest();
    await wrapped(req);

    expect(handler).toHaveBeenCalledWith(req, { session: { userId: "u1" } }, undefined);
  });

  it("passes routeCtx through to handler", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1" });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);
    const req = makeRequest();
    const routeCtx = { params: Promise.resolve({ id: "abc" }) };
    await wrapped(req, routeCtx);

    expect(handler).toHaveBeenCalledWith(req, { session: { userId: "u1" } }, routeCtx);
  });
});

describe("withTeamAuth", () => {
  it("returns 401 when session is null", async () => {
    mockGetSession.mockResolvedValue(null);

    const handler = vi.fn();
    const wrapped = withTeamAuth("viewer", handler);
    const res = await wrapped(makeRequest());

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("skips role check when x-team-id is absent", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1" });

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withTeamAuth("editor", handler);
    await wrapped(makeRequest());

    expect(mockRequireTeamRole).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(
      expect.any(NextRequest),
      { session: { userId: "u1" }, teamId: null },
      undefined
    );
  });

  it("calls requireTeamRole when x-team-id is present", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1" });
    mockRequireTeamRole.mockResolvedValue("editor");

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withTeamAuth("editor", handler);
    await wrapped(makeRequest({ "x-team-id": "team1" }));

    expect(mockRequireTeamRole).toHaveBeenCalledWith("u1", "team1", "editor");
    expect(handler).toHaveBeenCalledWith(
      expect.any(NextRequest),
      { session: { userId: "u1" }, teamId: "team1" },
      undefined
    );
  });

  it("returns error when requireTeamRole throws", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1" });

    const { AppError } = await import("@/lib/errors");
    mockRequireTeamRole.mockRejectedValue(new AppError(403, "Requires editor role or higher"));

    const handler = vi.fn();
    const wrapped = withTeamAuth("editor", handler);
    const res = await wrapped(makeRequest({ "x-team-id": "team1" }));

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("editor");
    expect(handler).not.toHaveBeenCalled();
  });
});
