import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, teamMembers, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/withAuth";
import { requireTeamRole } from "@/lib/teamAuth";
import { handleAppError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/request";

export const GET = withAuth(async (_req, { session }, routeCtx) => {
  const { id } = await routeCtx!.params;

  try {
    await requireTeamRole(session.userId, id, "viewer");
  } catch (e) {
    return handleAppError(e);
  }

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);

    if (!team) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const members = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        email: users.email,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, id));

    return NextResponse.json({ ...team, members });
  } catch (err) {
    console.error("[GET /api/teams/:id]", err);
    return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req, { session }, routeCtx) => {
  const { id } = await routeCtx!.params;

  try {
    await requireTeamRole(session.userId, id, "owner");
  } catch (e) {
    return handleAppError(e);
  }

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (e) {
    return handleAppError(e);
  }

  const { name } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Missing or invalid 'name'" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(teams)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/teams/:id]", err);
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (_req, { session }, routeCtx) => {
  const { id } = await routeCtx!.params;

  try {
    await requireTeamRole(session.userId, id, "owner");
  } catch (e) {
    return handleAppError(e);
  }

  try {
    await db.delete(teams).where(eq(teams.id, id));
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/teams/:id]", err);
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
  }
});
