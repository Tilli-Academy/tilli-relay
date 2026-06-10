import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { historyEntries } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/withAuth";

export const DELETE = withAuth(async (_req, { session }, routeCtx) => {
  const { id } = await routeCtx!.params;

  try {
    const deleted = await db
      .delete(historyEntries)
      .where(and(eq(historyEntries.id, id), eq(historyEntries.userId, session.userId)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/history/:id]", err);
    return NextResponse.json({ error: "Failed to delete history entry" }, { status: 500 });
  }
});
