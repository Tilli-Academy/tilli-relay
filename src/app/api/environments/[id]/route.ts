import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { environments, userActiveEnvironments } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import { withTeamAuth } from "@/lib/withAuth";
import { handleAppError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/request";
import { logActivity } from "@/lib/activityLog";

export const PUT = withTeamAuth("editor", async (req, { session, teamId }, routeCtx) => {
  const { id } = await routeCtx!.params;

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (e) {
    return handleAppError(e);
  }

  try {
    // Build the filter for userActiveEnvironments (same for personal & team)
    const activeFilter = teamId
      ? and(eq(userActiveEnvironments.userId, session.userId), eq(userActiveEnvironments.teamId, teamId))
      : and(eq(userActiveEnvironments.userId, session.userId), isNull(userActiveEnvironments.teamId));

    if (body.isActive === true) {
      // Activate: update userActiveEnvironments for both personal & team
      await db.transaction(async (tx) => {
        await tx.delete(userActiveEnvironments).where(activeFilter);
        await tx.insert(userActiveEnvironments).values({
          userId: session.userId,
          teamId: teamId || null,
          environmentId: id,
        });
      });

      // Personal workspace: also update the isActive column as fallback
      if (!teamId) {
        await db
          .update(environments)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(eq(environments.userId, session.userId), isNull(environments.teamId)));
      }
    } else if (body.isActive === false) {
      // Clear: remove userActiveEnvironments record
      await db.delete(userActiveEnvironments).where(activeFilter);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.isActive === "boolean" && !teamId) {
      // Only write isActive to the environments table for personal workspaces
      updates.isActive = body.isActive;
    }

    const envFilter = teamId
      ? and(eq(environments.id, id), eq(environments.teamId, teamId))
      : and(eq(environments.id, id), eq(environments.userId, session.userId), isNull(environments.teamId));

    const [updated] = await db
      .update(environments)
      .set(updates)
      .where(envFilter)
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/environments/:id]", err);
    return NextResponse.json({ error: "Failed to update environment" }, { status: 500 });
  }
});

export const DELETE = withTeamAuth("editor", async (req, { session, teamId }, routeCtx) => {
  const { id } = await routeCtx!.params;

  try {
    const envFilter = teamId
      ? and(eq(environments.id, id), eq(environments.teamId, teamId))
      : and(eq(environments.id, id), eq(environments.userId, session.userId), isNull(environments.teamId));

    const deleted = await db
      .delete(environments)
      .where(envFilter)
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (teamId) {
      logActivity(teamId, session.userId, "environment.deleted", "environment", id, deleted[0].name);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/environments/:id]", err);
    return NextResponse.json({ error: "Failed to delete environment" }, { status: 500 });
  }
});
