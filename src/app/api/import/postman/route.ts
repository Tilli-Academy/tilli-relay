import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collectionRequests, requests, folders } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import { withTeamAuth } from "@/lib/withAuth";
import { handleAppError } from "@/lib/errors";
import { logActivity } from "@/lib/activityLog";
import { parseJsonBody } from "@/lib/request";
import {
  parsePostmanCollection,
  validatePostmanJson,
} from "@/lib/postman/importer";

export const POST = withTeamAuth("editor", async (req, { session, teamId }) => {
  let json;
  try {
    json = await parseJsonBody(req, 5 * 1024 * 1024);
  } catch (e) {
    return handleAppError(e);
  }

  const validationError = validatePostmanJson(json);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  let imported;
  try {
    imported = parsePostmanCollection(json);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to parse Postman collection: " + (err instanceof Error ? err.message : "unknown error") },
      { status: 400 }
    );
  }

  if (imported.requests.length === 0) {
    return NextResponse.json(
      { error: "No requests found in collection" },
      { status: 400 }
    );
  }

  // Validate _folderId ownership if provided
  let folderId: string | null = null;
  if (json._folderId) {
    const ownerFilter = teamId
      ? and(eq(folders.id, json._folderId), eq(folders.teamId, teamId))
      : and(eq(folders.id, json._folderId), eq(folders.userId, session.userId), isNull(folders.teamId));

    const [folder] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(ownerFilter)
      .limit(1);

    if (!folder) {
      return NextResponse.json({ error: "Folder not found or access denied" }, { status: 400 });
    }
    folderId = folder.id;
  }

  try {
    const collection = await db.transaction(async (tx) => {

      const [col] = await tx
        .insert(collections)
        .values({
          name: imported.name,
          description: imported.description,
          folderId,
          userId: session.userId,
          teamId: teamId || null,
        })
        .returning();

      for (let i = 0; i < imported.requests.length; i++) {
        const r = imported.requests[i];
        const [request] = await tx
          .insert(requests)
          .values({
            name: r.name,
            curl: r.curl,
            userId: session.userId,
            teamId: teamId || null,
          })
          .returning();

        await tx.insert(collectionRequests).values({
          collectionId: col.id,
          requestId: request.id,
          sortOrder: i,
        });
      }

      return col;
    });

    if (teamId) {
      logActivity(teamId, session.userId, "collection.created", "collection", collection.id, imported.name, {
        importedRequests: imported.requests.length,
      });
    }

    return NextResponse.json(
      {
        collectionId: collection.id,
        name: imported.name,
        imported: imported.requests.length,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/import/postman]", err);
    return NextResponse.json(
      { error: "Failed to save imported collection" },
      { status: 500 }
    );
  }
});
