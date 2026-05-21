import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { environments } from "@/lib/schema";
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
    const filter = teamId
      ? eq(environments.teamId, teamId)
      : and(eq(environments.userId, session.userId), isNull(environments.teamId));

    const envs = await db
      .select()
      .from(environments)
      .where(filter)
      .orderBy(desc(environments.isActive), environments.createdAt);

    return NextResponse.json(envs);
  } catch (err) {
    console.error("[GET /api/environments]", err);
    return NextResponse.json({ error: "Failed to fetch environments" }, { status: 500 });
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

  const { name } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Missing or invalid 'name'" }, { status: 400 });
  }

  try {
    // Check if user/team has any environments — if not, make this one active
    const existFilter = teamId
      ? eq(environments.teamId, teamId)
      : and(eq(environments.userId, session.userId), isNull(environments.teamId));

    const existing = await db
      .select({ id: environments.id })
      .from(environments)
      .where(existFilter)
      .limit(1);

    const isFirst = existing.length === 0;

    const [created] = await db
      .insert(environments)
      .values({
        name: name.trim(),
        userId: session.userId,
        teamId: teamId || null,
        isActive: isFirst,
      })
      .returning();

    if (teamId) {
      logActivity(teamId, session.userId, "environment.created", "environment", created.id, created.name);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/environments]", err);
    return NextResponse.json({ error: "Failed to create environment" }, { status: 500 });
  }
}
