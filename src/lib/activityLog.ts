import { db } from "./db";
import { activityLogs } from "./schema";

/**
 * Log an activity entry for a team. Fire-and-forget — never blocks the caller.
 */
export function logActivity(
  teamId: string,
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  resourceName?: string,
  metadata?: Record<string, unknown>
): void {
  db.insert(activityLogs)
    .values({
      teamId,
      userId,
      action,
      resourceType,
      resourceId,
      resourceName: resourceName ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
    .execute()
    .catch((err) => {
      console.error("[activityLog] Failed to log activity:", err);
    });
}
