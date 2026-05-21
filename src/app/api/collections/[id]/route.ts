import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collectionRequests, requests } from "@/lib/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";
import { logActivity } from "@/lib/activityLog";

type RouteContext = { params: Promise<{ id: string }> };

async function findCollection(id: string, userId: string, teamId: string | null) {
  if (teamId) {
    return db
      .select()
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.teamId, teamId)))
      .limit(1);
  }
  return db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId), isNull(collections.teamId)))
    .limit(1);
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const teamId = req.headers.get("x-team-id");

  if (teamId) {
    try {
      await requireTeamRole(session.userId, teamId, "viewer");
    } catch (e: unknown) {
      const err = e as { status?: number; error?: string };
      return NextResponse.json({ error: err.error }, { status: err.status || 403 });
    }
  }

  try {
    const [collection] = await findCollection(id, session.userId, teamId);
    if (!collection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const colReqs = await db
      .select({
        id: collectionRequests.id,
        collectionId: collectionRequests.collectionId,
        requestId: collectionRequests.requestId,
        sortOrder: collectionRequests.sortOrder,
        request: requests,
      })
      .from(collectionRequests)
      .innerJoin(requests, eq(collectionRequests.requestId, requests.id))
      .where(eq(collectionRequests.collectionId, id))
      .orderBy(asc(collectionRequests.sortOrder));

    return NextResponse.json({ ...collection, requests: colReqs });
  } catch (err) {
    console.error("[GET /api/collections/:id]", err);
    return NextResponse.json({ error: "Failed to fetch collection" }, { status: 500 });
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

  const { name, description } = body;
  const data: Record<string, string | null> = {};
  if (name && typeof name === "string") data.name = name.trim();
  if (description !== undefined) data.description = description || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const [existing] = await findCollection(id, session.userId, teamId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(collections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(collections.id, id))
      .returning();

    if (teamId) {
      logActivity(teamId, session.userId, "collection.updated", "collection", id, updated.name);
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/collections/:id]", err);
    return NextResponse.json({ error: "Failed to update collection" }, { status: 500 });
  }
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
    const [existing] = await findCollection(id, session.userId, teamId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(collections).where(eq(collections.id, id));

    if (teamId) {
      logActivity(teamId, session.userId, "collection.deleted", "collection", id, existing.name);
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/collections/:id]", err);
    return NextResponse.json({ error: "Failed to delete collection" }, { status: 500 });
  }
}
