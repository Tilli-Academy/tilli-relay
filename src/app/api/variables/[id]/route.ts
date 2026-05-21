import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { environmentVariables, environments } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";

type RouteContext = { params: Promise<{ id: string }> };

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const KEY_MAX_LENGTH = 100;
const VALUE_MAX_LENGTH = 10_000;

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

  const data: Record<string, unknown> = {};

  if (body.key !== undefined) {
    if (typeof body.key !== "string" || !KEY_PATTERN.test(body.key)) {
      return NextResponse.json(
        { error: "Key must contain only letters, digits, and underscores, and start with a letter or underscore" },
        { status: 400 }
      );
    }
    if (body.key.length > KEY_MAX_LENGTH) {
      return NextResponse.json({ error: `Key must be ${KEY_MAX_LENGTH} characters or fewer` }, { status: 400 });
    }
    data.key = body.key.trim();
  }

  if (body.value !== undefined) {
    if (typeof body.value !== "string") {
      return NextResponse.json({ error: "Invalid 'value'" }, { status: 400 });
    }
    if (body.value.length > VALUE_MAX_LENGTH) {
      return NextResponse.json({ error: `Value must be ${VALUE_MAX_LENGTH} characters or fewer` }, { status: 400 });
    }
    data.value = body.value;
  }

  if (body.isSecret !== undefined) {
    data.isSecret = !!body.isSecret;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    // Find the variable — if in team context, allow any team member with editor role
    const [existing] = teamId
      ? await db
          .select({ id: environmentVariables.id, environmentId: environmentVariables.environmentId })
          .from(environmentVariables)
          .innerJoin(environments, eq(environmentVariables.environmentId, environments.id))
          .where(and(eq(environmentVariables.id, id), eq(environments.teamId, teamId)))
          .limit(1)
      : await db
          .select({ id: environmentVariables.id, environmentId: environmentVariables.environmentId })
          .from(environmentVariables)
          .where(and(eq(environmentVariables.id, id), eq(environmentVariables.userId, session.userId)))
          .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(environmentVariables)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(environmentVariables.id, id))
      .returning();

    return NextResponse.json({
      ...updated,
      value: updated.isSecret ? "" : updated.value,
    });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      return NextResponse.json({ error: "A variable with this key already exists" }, { status: 409 });
    }
    console.error("[PUT /api/variables/:id]", err);
    return NextResponse.json({ error: "Failed to update variable" }, { status: 500 });
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
    // Find the variable — if in team context, allow any team member with editor role
    const [existing] = teamId
      ? await db
          .select({ id: environmentVariables.id })
          .from(environmentVariables)
          .innerJoin(environments, eq(environmentVariables.environmentId, environments.id))
          .where(and(eq(environmentVariables.id, id), eq(environments.teamId, teamId)))
          .limit(1)
      : await db
          .select({ id: environmentVariables.id })
          .from(environmentVariables)
          .where(and(eq(environmentVariables.id, id), eq(environmentVariables.userId, session.userId)))
          .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(environmentVariables).where(eq(environmentVariables.id, id));
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/variables/:id]", err);
    return NextResponse.json({ error: "Failed to delete variable" }, { status: 500 });
  }
}
