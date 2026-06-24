import { NextRequest, NextResponse } from "next/server";
import { getSession } from "./auth";
import { requireTeamRole, type TeamRole } from "./teamAuth";
import { handleAppError } from "./errors";

// ── Types ──

export interface AuthContext {
  session: { userId: string };
}

export interface TeamAuthContext extends AuthContext {
  teamId: string | null;
}

type NextRouteContext = { params: Promise<Record<string, string>> };

type AuthenticatedHandler = (
  req: NextRequest,
  ctx: AuthContext,
  routeCtx?: NextRouteContext
) => Promise<NextResponse>;

type TeamAuthenticatedHandler = (
  req: NextRequest,
  ctx: TeamAuthContext,
  routeCtx?: NextRouteContext
) => Promise<NextResponse>;

/**
 * Session-only auth wrapper. Use for routes that don't need team role checks
 * (e.g. teams/route, history, upload, share).
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest, routeCtx?: NextRouteContext): Promise<NextResponse> => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return handler(req, { session }, routeCtx);
  };
}

/**
 * Session + optional team role auth wrapper. Reads x-team-id header and
 * validates the user has at least `role` in that team.
 * Use for resource routes (requests, collections, folders, etc.).
 */
export function withTeamAuth(role: TeamRole, handler: TeamAuthenticatedHandler) {
  return async (req: NextRequest, routeCtx?: NextRouteContext): Promise<NextResponse> => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const teamId = req.headers.get("x-team-id");

    if (teamId) {
      try {
        await requireTeamRole(session.userId, teamId, role);
      } catch (e) {
        return handleAppError(e);
      }
    }

    return handler(req, { session, teamId }, routeCtx);
  };
}
