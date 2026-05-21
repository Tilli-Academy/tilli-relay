import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activityLogs, users } from "@/lib/schema";
import { eq, desc, count } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { requireTeamRole } from "@/lib/teamAuth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  req: NextRequest,
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

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    const entries = await db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        resourceType: activityLogs.resourceType,
        resourceId: activityLogs.resourceId,
        resourceName: activityLogs.resourceName,
        metadata: activityLogs.metadata,
        createdAt: activityLogs.createdAt,
        userId: activityLogs.userId,
        actorEmail: users.email,
      })
      .from(activityLogs)
      .innerJoin(users, eq(activityLogs.userId, users.id))
      .where(eq(activityLogs.teamId, id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(activityLogs)
      .where(eq(activityLogs.teamId, id));

    return NextResponse.json({ entries, total });
  } catch (err) {
    console.error("[GET /api/teams/:id/activity]", err);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
