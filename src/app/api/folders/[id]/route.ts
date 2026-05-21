import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { folders, collections } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";
import { logActivity } from "@/lib/activityLog";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const teamId = req.headers.get("x-team-id");

  if (teamId) {
    try {
      await requireTeamRole(session.userId, teamId, "editor");
    } catch (e: unknown) {
      const err = e as { status?: number; error?: string };
      return NextResponse.json({ error: err.error }, { status: err.status || 403 });
    }
  }

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
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const teamId = req.headers.get("x-team-id");

  if (teamId) {
    try {
      await requireTeamRole(session.userId, teamId, "editor");
    } catch (e: unknown) {
      const err = e as { status?: number; error?: string };
      return NextResponse.json({ error: err.error }, { status: err.status || 403 });
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
}
