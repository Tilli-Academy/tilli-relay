import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collectionRequests, requests } from "@/lib/schema";
import { eq, and, desc, asc, isNull, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";
import { logActivity } from "@/lib/activityLog";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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
    const filter = teamId
      ? eq(collections.teamId, teamId)
      : and(eq(collections.userId, session.userId), isNull(collections.teamId));

    const cols = await db
      .select()
      .from(collections)
      .where(filter)
      .orderBy(desc(collections.updatedAt));

    const colIds = cols.map((c) => c.id);
    let allLinks: {
      id: string;
      collectionId: string;
      requestId: string;
      sortOrder: number;
      request: typeof requests.$inferSelect;
    }[] = [];

    if (colIds.length > 0) {
      allLinks = await db
        .select({
          id: collectionRequests.id,
          collectionId: collectionRequests.collectionId,
          requestId: collectionRequests.requestId,
          sortOrder: collectionRequests.sortOrder,
          request: requests,
        })
        .from(collectionRequests)
        .innerJoin(requests, eq(collectionRequests.requestId, requests.id))
        .where(inArray(collectionRequests.collectionId, colIds))
        .orderBy(asc(collectionRequests.sortOrder));
    }

    const linksByCollection = new Map<string, typeof allLinks>();
    for (const link of allLinks) {
      const list = linksByCollection.get(link.collectionId) ?? [];
      list.push(link);
      linksByCollection.set(link.collectionId, list);
    }

    const result = cols.map((col) => ({
      ...col,
      requests: linksByCollection.get(col.id) ?? [],
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/collections]", err);
    return NextResponse.json({ error: "Failed to fetch collections" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

  const { name, description, folderId } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'name'" }, { status: 400 });
  }

  try {
    const [created] = await db
      .insert(collections)
      .values({
        name: name.trim(),
        description: description || null,
        folderId: folderId || null,
        userId: session.userId,
        teamId: teamId || null,
      })
      .returning();

    if (teamId) {
      logActivity(teamId, session.userId, "collection.created", "collection", created.id, created.name);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/collections]", err);
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}
