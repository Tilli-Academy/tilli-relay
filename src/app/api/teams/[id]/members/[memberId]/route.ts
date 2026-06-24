import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamMembers, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/withAuth";
import { requireTeamRole } from "@/lib/teamAuth";
import { handleAppError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/request";
import { logActivity } from "@/lib/activityLog";

export const PUT = withAuth(async (req, { session }, routeCtx) => {
  const { id, memberId } = await routeCtx!.params;

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

  const { role } = body;
  const validRoles = ["owner", "editor", "viewer"];
  if (!role || !validRoles.includes(role)) {
    return NextResponse.json({ error: "Role must be 'owner', 'editor', or 'viewer'" }, { status: 400 });
  }

  try {
    // Fetch the target member
    const [target] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, id)))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prevent demoting self if sole owner
    if (target.userId === session.userId && target.role === "owner" && role !== "owner") {
      const owners = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, id), eq(teamMembers.role, "owner")));
      if (owners.length <= 1) {
        return NextResponse.json({ error: "Cannot demote the only owner" }, { status: 400 });
      }
    }

    const [updated] = await db
      .update(teamMembers)
      .set({ role })
      .where(eq(teamMembers.id, memberId))
      .returning();

    // Get email for activity log
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, target.userId))
      .limit(1);

    logActivity(id, session.userId, "member.role_changed", "member", target.userId, user?.email, {
      oldRole: target.role,
      newRole: role,
    });

    return NextResponse.json({ ...updated, email: user?.email });
  } catch (err) {
    console.error("[PUT /api/teams/:id/members/:memberId]", err);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (_req, { session }, routeCtx) => {
  const { id, memberId } = await routeCtx!.params;

  try {
    await requireTeamRole(session.userId, id, "owner");
  } catch (e) {
    return handleAppError(e);
  }

  try {
    const [target] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, id)))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prevent removing sole owner
    if (target.role === "owner") {
      const owners = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, id), eq(teamMembers.role, "owner")));
      if (owners.length <= 1) {
        return NextResponse.json({ error: "Cannot remove the only owner" }, { status: 400 });
      }
    }

    await db.delete(teamMembers).where(eq(teamMembers.id, memberId));

    // Get email for activity log
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, target.userId))
      .limit(1);

    logActivity(id, session.userId, "member.removed", "member", target.userId, user?.email);

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/teams/:id/members/:memberId]", err);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
});
