import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sharedRequests, requests } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { generateShareToken } from "@/lib/shareToken";
import { requireTeamRole } from "@/lib/teamAuth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json({ error: "Missing 'requestId' query parameter" }, { status: 400 });
  }

  try {
    const shares = await db
      .select()
      .from(sharedRequests)
      .where(and(
        eq(sharedRequests.requestId, requestId),
        eq(sharedRequests.sharedByUserId, session.userId)
      ));

    // Filter out expired links
    const now = new Date();
    const active = shares.filter((s) => !s.expiresAt || s.expiresAt > now);

    return NextResponse.json(active);
  } catch (err) {
    console.error("[GET /api/share]", err);
    return NextResponse.json({ error: "Failed to fetch share links" }, { status: 500 });
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

  const { requestId, expiresInHours } = body;

  if (!requestId || typeof requestId !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'requestId'" }, { status: 400 });
  }

  try {
    // Verify access to the request (personal or team)
    const [request] = await db
      .select()
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1);

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Check access: if team request, require editor role; if personal, must be owner
    if (request.teamId) {
      try {
        await requireTeamRole(session.userId, request.teamId, "editor");
      } catch {
        return NextResponse.json({ error: "Not authorized to share this request" }, { status: 403 });
      }
    } else if (request.userId !== session.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const token = generateShareToken();
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null;

    const [share] = await db
      .insert(sharedRequests)
      .values({
        requestId,
        sharedByUserId: session.userId,
        token,
        expiresAt,
      })
      .returning();

    return NextResponse.json(share, { status: 201 });
  } catch (err) {
    console.error("[POST /api/share]", err);
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }
}
