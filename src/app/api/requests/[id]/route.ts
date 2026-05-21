import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requests } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";
import { logActivity } from "@/lib/activityLog";

type RouteContext = { params: Promise<{ id: string }> };

async function findRequest(id: string, userId: string, teamId: string | null) {
  if (teamId) {
    return db
      .select()
      .from(requests)
      .where(and(eq(requests.id, id), eq(requests.teamId, teamId)))
      .limit(1);
  }
  return db
    .select()
    .from(requests)
    .where(and(eq(requests.id, id), eq(requests.userId, userId), isNull(requests.teamId)))
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
    const [request] = await findRequest(id, session.userId, teamId);
    if (!request) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(request);
  } catch (err) {
    console.error("[GET /api/requests/:id]", err);
    return NextResponse.json({ error: "Failed to fetch request" }, { status: 500 });
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

  const { name, curl } = body;
  const data: Record<string, string> = {};
  if (name && typeof name === "string") data.name = name.trim();
  if (curl && typeof curl === "string") data.curl = curl;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const [existing] = await findRequest(id, session.userId, teamId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(requests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(requests.id, id))
      .returning();

    if (teamId) {
      logActivity(teamId, session.userId, "request.updated", "request", id, updated.name);
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/requests/:id]", err);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
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
    const [existing] = await findRequest(id, session.userId, teamId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(requests).where(eq(requests.id, id));

    if (teamId) {
      logActivity(teamId, session.userId, "request.deleted", "request", id, existing.name);
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/requests/:id]", err);
    return NextResponse.json({ error: "Failed to delete request" }, { status: 500 });
  }
}
