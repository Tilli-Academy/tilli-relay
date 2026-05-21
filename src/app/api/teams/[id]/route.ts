import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, teamMembers, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await requireTeamRole(session.userId, id, "viewer");
  } catch (e: unknown) {
    const err = e as { status?: number; error?: string };
    return NextResponse.json({ error: err.error }, { status: err.status || 403 });
  }

  try {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);

    if (!team) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const members = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        email: users.email,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, id));

    return NextResponse.json({ ...team, members });
  } catch (err) {
    console.error("[GET /api/teams/:id]", err);
    return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: RouteContext
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await requireTeamRole(session.userId, id, "owner");
  } catch (e: unknown) {
    const err = e as { status?: number; error?: string };
    return NextResponse.json({ error: err.error }, { status: err.status || 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Missing or invalid 'name'" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(teams)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/teams/:id]", err);
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await requireTeamRole(session.userId, id, "owner");
  } catch (e: unknown) {
    const err = e as { status?: number; error?: string };
    return NextResponse.json({ error: err.error }, { status: err.status || 403 });
  }

  try {
    await db.delete(teams).where(eq(teams.id, id));
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/teams/:id]", err);
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
  }
}
