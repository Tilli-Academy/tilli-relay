import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamMembers, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/withAuth";
import { requireTeamRole } from "@/lib/teamAuth";
import { handleAppError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/request";
import { logActivity } from "@/lib/activityLog";

export const GET = withAuth(async (_req, { session }, routeCtx) => {
  const { id } = await routeCtx!.params;

  try {
    await requireTeamRole(session.userId, id, "viewer");
  } catch (e) {
    return handleAppError(e);
  }

  try {
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

    return NextResponse.json(members);
  } catch (err) {
    console.error("[GET /api/teams/:id/members]", err);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, { session }, routeCtx) => {
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

  const { email, role } = body;
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'email'" }, { status: 400 });
  }

  const validRoles = ["editor", "viewer"];
  if (!role || !validRoles.includes(role)) {
    return NextResponse.json({ error: "Role must be 'editor' or 'viewer'" }, { status: 400 });
  }

  try {
    // Find user by email
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "No user found with that email" }, { status: 404 });
    }

    // Add member
    const [member] = await db
      .insert(teamMembers)
      .values({
        teamId: id,
        userId: user.id,
        role,
      })
      .returning();

    logActivity(id, session.userId, "member.added", "member", user.id, user.email, { role });

    return NextResponse.json({
      ...member,
      email: user.email,
    }, { status: 201 });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      return NextResponse.json({ error: "User is already a member of this team" }, { status: 409 });
    }
    console.error("[POST /api/teams/:id/members]", err);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
});
