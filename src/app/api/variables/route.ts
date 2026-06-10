import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { environmentVariables, environments } from "@/lib/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { withTeamAuth } from "@/lib/withAuth";
import { handleAppError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/request";
import { encrypt } from "@/lib/crypto";

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const KEY_MAX_LENGTH = 100;
const VALUE_MAX_LENGTH = 10_000;

export const GET = withTeamAuth("viewer", async (req, { session, teamId }) => {
  const { searchParams } = new URL(req.url);
  const environmentId = searchParams.get("environmentId");

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
});

export const POST = withTeamAuth("editor", async (req, { session, teamId }) => {
  let body;
  try {
    body = await parseJsonBody(req);
  } catch (e) {
    return handleAppError(e);
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
    // Verify the user/team actually owns this environment (prevents IDOR)
    if (environmentId) {
      const [env] = teamId
        ? await db
            .select({ id: environments.id })
            .from(environments)
            .where(and(eq(environments.id, environmentId), eq(environments.teamId, teamId)))
            .limit(1)
        : await db
            .select({ id: environments.id })
            .from(environments)
            .where(and(eq(environments.id, environmentId), eq(environments.userId, session.userId), isNull(environments.teamId)))
            .limit(1);

      if (!env) {
        return NextResponse.json({ error: "Environment not found or access denied" }, { status: 403 });
      }
    }

    const storedValue = isSecret ? encrypt(value) : value;

    const [created] = await db
      .insert(environmentVariables)
      .values({
        key: key.trim(),
        value: storedValue,
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
});
