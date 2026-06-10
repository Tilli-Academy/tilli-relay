import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collectionRequests, requests } from "@/lib/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { withTeamAuth } from "@/lib/withAuth";
import { handleAppError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/request";

async function findCollection(id: string, userId: string, teamId: string | null) {
  if (teamId) {
    return db
      .select({ id: collections.id, teamId: collections.teamId })
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.teamId, teamId)))
      .limit(1);
  }
  return db
    .select({ id: collections.id, teamId: collections.teamId })
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId), isNull(collections.teamId)))
    .limit(1);
}

export const POST = withTeamAuth("editor", async (req, { session, teamId }, routeCtx) => {
  const { id: collectionId } = await routeCtx!.params;

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (e) {
    return handleAppError(e);
  }

  try {
    const [collection] = await findCollection(collectionId, session.userId, teamId);
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    let requestId: string;

    if (body.requestId) {
      // Verify request access
      const reqFilter = teamId
        ? and(eq(requests.id, body.requestId), eq(requests.teamId, teamId))
        : and(eq(requests.id, body.requestId), eq(requests.userId, session.userId));

      const [existing] = await db
        .select({ id: requests.id })
        .from(requests)
        .where(reqFilter)
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }
      requestId = body.requestId;
    } else if (body.name && body.curl) {
      const [newRequest] = await db
        .insert(requests)
        .values({
          name: body.name.trim(),
          curl: body.curl,
          userId: session.userId,
          teamId: teamId || null,
        })
        .returning();
      requestId = newRequest.id;
    } else {
      return NextResponse.json(
        { error: "Provide 'requestId' or both 'name' and 'curl'" },
        { status: 400 }
      );
    }

    // Get max sort order
    const [maxSort] = await db
      .select({ sortOrder: collectionRequests.sortOrder })
      .from(collectionRequests)
      .where(eq(collectionRequests.collectionId, collectionId))
      .orderBy(desc(collectionRequests.sortOrder))
      .limit(1);

    const sortOrder = (maxSort?.sortOrder ?? -1) + 1;

    const [link] = await db
      .insert(collectionRequests)
      .values({ collectionId, requestId, sortOrder })
      .returning();

    const [request] = await db
      .select()
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1);

    return NextResponse.json({ ...link, request }, { status: 201 });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      return NextResponse.json({ error: "Request already in collection" }, { status: 409 });
    }
    console.error("[POST /api/collections/:id/requests]", err);
    return NextResponse.json({ error: "Failed to add request to collection" }, { status: 500 });
  }
});

export const DELETE = withTeamAuth("editor", async (req, { session, teamId }, routeCtx) => {
  const { id: collectionId } = await routeCtx!.params;

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (e) {
    return handleAppError(e);
  }

  const { requestId } = body;
  if (!requestId || typeof requestId !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'requestId'" }, { status: 400 });
  }

  try {
    const [collection] = await findCollection(collectionId, session.userId, teamId);
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const deleted = await db
      .delete(collectionRequests)
      .where(
        and(
          eq(collectionRequests.collectionId, collectionId),
          eq(collectionRequests.requestId, requestId)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Request not found in collection" }, { status: 404 });
    }

    return NextResponse.json({ removed: true });
  } catch (err) {
    console.error("[DELETE /api/collections/:id/requests]", err);
    return NextResponse.json({ error: "Failed to remove request from collection" }, { status: 500 });
  }
});
