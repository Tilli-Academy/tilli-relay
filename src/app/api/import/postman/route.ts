import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collectionRequests, requests } from "@/lib/schema";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";
import { logActivity } from "@/lib/activityLog";
import {
  parsePostmanCollection,
  validatePostmanJson,
} from "@/lib/postman/importer";

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

  let json;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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

  try {
    const collection = await db.transaction(async (tx) => {
      const folderId = json._folderId || null;

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
}
