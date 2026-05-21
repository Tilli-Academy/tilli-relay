import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { folders, collections, collectionRequests, requests } from "@/lib/schema";
import { eq, and, desc, asc, isNull, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";
import { logActivity } from "@/lib/activityLog";

/**
 * GET /api/folders
 * Returns all folders with their nested collections and requests,
 * plus ungrouped collections (no folder).
 */
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
    const folderFilter = teamId
      ? eq(folders.teamId, teamId)
      : and(eq(folders.userId, session.userId), isNull(folders.teamId));

    const colFilter = teamId
      ? eq(collections.teamId, teamId)
      : and(eq(collections.userId, session.userId), isNull(collections.teamId));

    // Fetch folders
    const userFolders = await db
      .select()
      .from(folders)
      .where(folderFilter)
      .orderBy(desc(folders.updatedAt));

    // Fetch all collections
    const allCols = await db
      .select()
      .from(collections)
      .where(colFilter)
      .orderBy(desc(collections.updatedAt));

    // Fetch all collection-request links
    const colIds = allCols.map((c) => c.id);
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

    // Group links by collection
    const linksByCollection = new Map<string, typeof allLinks>();
    for (const link of allLinks) {
      const list = linksByCollection.get(link.collectionId) ?? [];
      list.push(link);
      linksByCollection.set(link.collectionId, list);
    }

    // Build collections with requests
    const colsWithRequests = allCols.map((col) => ({
      ...col,
      requests: linksByCollection.get(col.id) ?? [],
    }));

    // Group collections by folder
    const colsByFolder = new Map<string, typeof colsWithRequests>();
    const ungrouped: typeof colsWithRequests = [];
    for (const col of colsWithRequests) {
      if (col.folderId) {
        const list = colsByFolder.get(col.folderId) ?? [];
        list.push(col);
        colsByFolder.set(col.folderId, list);
      } else {
        ungrouped.push(col);
      }
    }

    const result = {
      folders: userFolders.map((f) => ({
        ...f,
        collections: colsByFolder.get(f.id) ?? [],
      })),
      collections: ungrouped,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/folders]", err);
    return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
  }
}

/**
 * POST /api/folders
 * Creates a new folder.
 */
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

  const { name } = body;
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'name'" }, { status: 400 });
  }

  try {
    const [created] = await db
      .insert(folders)
      .values({
        name: name.trim(),
        userId: session.userId,
        teamId: teamId || null,
      })
      .returning();

    if (teamId) {
      logActivity(teamId, session.userId, "folder.created", "folder", created.id, created.name);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/folders]", err);
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}
