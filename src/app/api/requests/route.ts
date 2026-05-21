import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requests, collectionRequests } from "@/lib/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
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
    // Exclude requests that belong to a collection — those show under Collections only
    const linkedRequestIds = db
      .selectDistinct({ id: collectionRequests.requestId })
      .from(collectionRequests);

    const filter = teamId
      ? eq(requests.teamId, teamId)
      : and(eq(requests.userId, session.userId), isNull(requests.teamId));

    const result = await db
      .select()
      .from(requests)
      .where(filter)
      .orderBy(desc(requests.updatedAt));

    // Filter in JS to avoid empty subquery issues
    const linkedIds = new Set((await linkedRequestIds).map((r) => r.id));
    const standalone = result.filter((r) => !linkedIds.has(r.id));

    return NextResponse.json(standalone);
  } catch (err) {
    console.error("[GET /api/requests]", err);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
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

  const { name, curl } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'name'" }, { status: 400 });
  }

  if (!curl || typeof curl !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'curl'" }, { status: 400 });
  }

  try {
    const [created] = await db
      .insert(requests)
      .values({
        name: name.trim(),
        curl,
        userId: session.userId,
        teamId: teamId || null,
      })
      .returning();

    if (teamId) {
      logActivity(teamId, session.userId, "request.created", "request", created.id, created.name);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/requests]", err);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
