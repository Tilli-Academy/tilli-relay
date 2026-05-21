import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sharedRequests, requests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { parseCurl } from "@/lib/curl/parser";

type RouteContext = { params: Promise<{ token: string }> };

/** Public endpoint — resolves a share token to a request's curl command. */
export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  const { token } = await params;

  if (!token || typeof token !== "string" || token.length < 32) {
    return NextResponse.json({ error: "Invalid share token" }, { status: 400 });
  }

  try {
    const [share] = await db
      .select()
      .from(sharedRequests)
      .where(eq(sharedRequests.token, token))
      .limit(1);

    if (!share) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    // Check expiration
    if (share.expiresAt && share.expiresAt < new Date()) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
    }

    // Fetch the request
    const [request] = await db
      .select({ name: requests.name, curl: requests.curl })
      .from(requests)
      .where(eq(requests.id, share.requestId))
      .limit(1);

    if (!request) {
      return NextResponse.json({ error: "Shared request no longer exists" }, { status: 404 });
    }

    // Parse curl to extract method and URL for display
    const parsed = parseCurl(request.curl);

    return NextResponse.json({
      name: request.name,
      curl: request.curl,
      method: parsed.method,
      url: parsed.url,
    });
  } catch (err) {
    console.error("[GET /api/share/:token]", err);
    return NextResponse.json({ error: "Failed to resolve share link" }, { status: 500 });
  }
}

/** Revoke a share link — requires auth + ownership. */
export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { token } = await params;

  try {
    const deleted = await db
      .delete(sharedRequests)
      .where(eq(sharedRequests.token, token))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Only allow the creator to revoke
    if (deleted[0].sharedByUserId !== session.userId) {
      // Re-insert it since we already deleted
      await db.insert(sharedRequests).values(deleted[0]);
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/share/:token]", err);
    return NextResponse.json({ error: "Failed to revoke share link" }, { status: 500 });
  }
}
