import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { folders, collections } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import { withTeamAuth } from "@/lib/withAuth";
import { handleAppError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/request";
import { logActivity } from "@/lib/activityLog";

async function findFolder(id: string, userId: string, teamId: string | null) {
  if (teamId) {
    return db
      .select()
      .from(folders)
      .where(and(eq(folders.id, id), eq(folders.teamId, teamId)))
      .limit(1);
  }
  return db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, userId), isNull(folders.teamId)))
    .limit(1);
}

export const DELETE = withTeamAuth("editor", async (req, { session, teamId }, routeCtx) => {
  const { id } = await routeCtx!.params;

  try {
    const [existing] = await findFolder(id, session.userId, teamId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Unlink collections from this folder (don't delete them)
    await db
      .update(collections)
      .set({ folderId: null })
      .where(eq(collections.folderId, id));

    await db.delete(folders).where(eq(folders.id, id));

    if (teamId) {
      logActivity(teamId, session.userId, "folder.deleted", "folder", id, existing.name);
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/folders/:id]", err);
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 });
  }
});

export const PUT = withTeamAuth("editor", async (req, { session, teamId }, routeCtx) => {
  const { id } = await routeCtx!.params;

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (e) {
    return handleAppError(e);
  }

  const { name } = body;
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'name'" }, { status: 400 });
  }

  try {
    const [existing] = await findFolder(id, session.userId, teamId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(folders)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(folders.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/folders/:id]", err);
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
  }
});
