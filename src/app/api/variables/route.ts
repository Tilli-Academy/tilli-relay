import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { environmentVariables, environments } from "@/lib/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const KEY_MAX_LENGTH = 100;
const VALUE_MAX_LENGTH = 10_000;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const environmentId = searchParams.get("environmentId");
  const teamId = req.headers.get("x-team-id");

  // If a teamId is provided, verify access via the environment's team
  if (teamId) {
    try {
      await requireTeamRole(session.userId, teamId, "viewer");
    } catch (e: unknown) {
      const err = e as { status?: number; error?: string };
      return NextResponse.json({ error: err.error }, { status: err.status || 403 });
    }
  }

  try {
    const conditions = [];
    if (teamId && environmentId) {
      // Team context: show all variables in this team environment regardless of creator
      conditions.push(eq(environmentVariables.environmentId, environmentId));
    } else if (environmentId) {
      // Personal context with specific environment
      conditions.push(eq(environmentVariables.userId, session.userId));
      conditions.push(eq(environmentVariables.environmentId, environmentId));
    } else {
      // Personal context, no environment
      conditions.push(eq(environmentVariables.userId, session.userId));
      conditions.push(isNull(environmentVariables.environmentId));
    }

    const result = await db
      .select()
      .from(environmentVariables)
      .where(and(...conditions))
      .orderBy(asc(environmentVariables.key));

    // Mask secret values
    const masked = result.map((v) => ({
      ...v,
      value: v.isSecret ? "" : v.value,
    }));

    return NextResponse.json(masked);
  } catch (err) {
    console.error("[GET /api/variables]", err);
    return NextResponse.json({ error: "Failed to fetch variables" }, { status: 500 });
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

  const { key, value, isSecret, environmentId } = body;

  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'key'" }, { status: 400 });
  }
  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json(
      { error: "Key must contain only letters, digits, and underscores, and start with a letter or underscore" },
      { status: 400 }
    );
  }
  if (key.length > KEY_MAX_LENGTH) {
    return NextResponse.json({ error: `Key must be ${KEY_MAX_LENGTH} characters or fewer` }, { status: 400 });
  }
  if (typeof value !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'value'" }, { status: 400 });
  }
  if (value.length > VALUE_MAX_LENGTH) {
    return NextResponse.json({ error: `Value must be ${VALUE_MAX_LENGTH} characters or fewer` }, { status: 400 });
  }

  try {
    const [created] = await db
      .insert(environmentVariables)
      .values({
        key: key.trim(),
        value,
        isSecret: !!isSecret,
        userId: session.userId,
        environmentId: environmentId || null,
      })
      .returning();

    return NextResponse.json(
      { ...created, value: created.isSecret ? "" : created.value },
      { status: 201 }
    );
  } catch (err) {
    const pgErr = err as { code?: string; message?: string; cause?: { code?: string } };
    if (pgErr?.code === "23505" || pgErr?.cause?.code === "23505" ||
        (typeof pgErr?.message === "string" && (pgErr.message.includes("unique") || pgErr.message.includes("duplicate")))) {
      return NextResponse.json({ error: "A variable with this key already exists in this environment" }, { status: 409 });
    }
    console.error("[POST /api/variables]", err);
    return NextResponse.json({ error: "Failed to create variable" }, { status: 500 });
  }
}
