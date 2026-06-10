import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, teamMembers, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/withAuth";
import { handleAppError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/request";

export const GET = withAuth(async (_req, { session }) => {
  try {
    const result = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        createdAt: teams.createdAt,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, session.userId));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/teams]", err);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, { session }) => {
  let body;
  try {
    body = await parseJsonBody(req);
  } catch (e) {
    return handleAppError(e);
  }

  const { name } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Missing or invalid 'name'" }, { status: 400 });
  }

  const trimmed = name.trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) {
    return NextResponse.json({ error: "Name must contain at least one alphanumeric character" }, { status: 400 });
  }

  try {
    // Check slug uniqueness
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, slug))
      .limit(1);

    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    const [team] = await db
      .insert(teams)
      .values({ name: trimmed, slug: finalSlug })
      .returning();

    // Creator becomes owner
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: session.userId,
      role: "owner",
    });

    // Fetch creator email for response
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    return NextResponse.json({
      ...team,
      role: "owner",
      members: [{ userId: session.userId, email: user?.email, role: "owner" }],
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/teams]", err);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
});
