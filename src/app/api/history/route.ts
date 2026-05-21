import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { historyEntries } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

const MAX_BODY_SIZE = 1_000_000; // 1MB cap for stored response bodies

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    const entries = await db
      .select()
      .from(historyEntries)
      .where(eq(historyEntries.userId, session.userId))
      .orderBy(desc(historyEntries.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(entries);
  } catch (err) {
    console.error("[GET /api/history]", err);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { method, url, curl, statusCode, timeMs, responseHeaders, responseBody } = body;

  if (!method || !url || !curl || statusCode == null || timeMs == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Cap response body at 1MB
    const cappedBody =
      typeof responseBody === "string" && responseBody.length > MAX_BODY_SIZE
        ? responseBody.slice(0, MAX_BODY_SIZE) + "\n\n[Response truncated — exceeded 1MB]"
        : responseBody || "";

    const [created] = await db
      .insert(historyEntries)
      .values({
        userId: session.userId,
        method,
        url,
        curl,
        statusCode,
        timeMs,
        responseHeaders: typeof responseHeaders === "object" ? JSON.stringify(responseHeaders) : responseHeaders || "{}",
        responseBody: cappedBody,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/history]", err);
    return NextResponse.json({ error: "Failed to save history entry" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await db
      .delete(historyEntries)
      .where(eq(historyEntries.userId, session.userId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/history]", err);
    return NextResponse.json({ error: "Failed to clear history" }, { status: 500 });
  }
}
