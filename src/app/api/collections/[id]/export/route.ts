import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collections, collectionRequests, requests } from "@/lib/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";
import { exportAsPostmanJson, exportAsShellScript } from "@/lib/postman/exporter";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const teamId = req.headers.get("x-team-id");
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "postman";

  if (teamId) {
    try {
      await requireTeamRole(session.userId, teamId, "viewer");
    } catch (e: unknown) {
      const err = e as { status?: number; error?: string };
      return NextResponse.json({ error: err.error }, { status: err.status || 403 });
    }
  }

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
      const filename = `${collection.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.reqify.json`;

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
}
