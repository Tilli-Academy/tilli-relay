import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collectionRequests, requests } from "@/lib/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { withTeamAuth } from "@/lib/withAuth";
import { exportAsPostmanJson, exportAsShellScript } from "@/lib/postman/exporter";

export const GET = withTeamAuth("viewer", async (req, { session, teamId }, routeCtx) => {
  const { id } = await routeCtx!.params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "postman";

  if (!["postman", "shell"].includes(format)) {
    return NextResponse.json({ error: "Invalid format. Use 'postman' or 'shell'" }, { status: 400 });
  }

  try {
    const colFilter = teamId
      ? and(eq(collections.id, id), eq(collections.teamId, teamId))
      : and(eq(collections.id, id), eq(collections.userId, session.userId), isNull(collections.teamId));

    const [collection] = await db
      .select()
      .from(collections)
      .where(colFilter)
      .limit(1);

    if (!collection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const colReqs = await db
      .select({
        name: requests.name,
        curl: requests.curl,
      })
      .from(collectionRequests)
      .innerJoin(requests, eq(collectionRequests.requestId, requests.id))
      .where(eq(collectionRequests.collectionId, id))
      .orderBy(asc(collectionRequests.sortOrder));

    const exportData = {
      name: collection.name,
      description: collection.description,
      requests: colReqs,
    };

    if (format === "postman") {
      const postmanJson = exportAsPostmanJson(exportData);
      const filename = `${collection.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.relay.json`;

      return new NextResponse(JSON.stringify(postmanJson, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } else {
      const script = exportAsShellScript(exportData);
      const filename = `${collection.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.sh`;

      return new NextResponse(script, {
        status: 200,
        headers: {
          "Content-Type": "text/x-shellscript",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (err) {
    console.error("[GET /api/collections/:id/export]", err);
    return NextResponse.json({ error: "Failed to export collection" }, { status: 500 });
  }
});
