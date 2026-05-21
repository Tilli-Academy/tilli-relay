import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamMembers, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";
import { logActivity } from "@/lib/activityLog";

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

    return NextResponse.json(members);
  } catch (err) {
    console.error("[GET /api/teams/:id/members]", err);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

export async function POST(
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

  const { email, role } = body;
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'email'" }, { status: 400 });
  }

  const validRoles = ["editor", "viewer"];
  if (!role || !validRoles.includes(role)) {
    return NextResponse.json({ error: "Role must be 'editor' or 'viewer'" }, { status: 400 });
  }

  try {
    // Find user by email
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "No user found with that email" }, { status: 404 });
    }

    // Add member
    const [member] = await db
      .insert(teamMembers)
      .values({
        teamId: id,
        userId: user.id,
        role,
      })
      .returning();

    logActivity(id, session.userId, "member.added", "member", user.id, user.email, { role });

    return NextResponse.json({
      ...member,
      email: user.email,
    }, { status: 201 });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      return NextResponse.json({ error: "User is already a member of this team" }, { status: 409 });
    }
    console.error("[POST /api/teams/:id/members]", err);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}
