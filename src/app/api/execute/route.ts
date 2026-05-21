import { NextRequest, NextResponse } from "next/server";
import { executeCurl } from "@/lib/curl/executor";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { environmentVariables, environments } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveVariables } from "@/lib/variables/substitutor";
import { cleanupTempFiles } from "@/lib/upload";
import { requireTeamRole } from "@/lib/teamAuth";
import { logActivity } from "@/lib/activityLog";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate limit: 30 requests per minute per user
  const rl = await checkRateLimit(`execute:${session.userId}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const teamId = req.headers.get("x-team-id");

  if (teamId) {
    try {
      await requireTeamRole(session.userId, teamId, "viewer");
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

  const { curl } = body;

  if (!curl || typeof curl !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'curl' field" }, { status: 400 });
  }

  // Resolve {{VARIABLE}} placeholders with active environment's variables
  let resolvedCurl = curl;
  let warning: string | undefined;
  try {
    // Find the active environment for the current workspace context
    const envFilter = teamId
      ? and(eq(environments.teamId, teamId), eq(environments.isActive, true))
      : and(eq(environments.userId, session.userId), isNull(environments.teamId), eq(environments.isActive, true));

    const [activeEnv] = await db
      .select({ id: environments.id })
      .from(environments)
      .where(envFilter)
      .limit(1);

    // Load variables: from active environment if exists, otherwise all user vars (backwards compat)
    const userVars = activeEnv
      ? await db
          .select({ key: environmentVariables.key, value: environmentVariables.value })
          .from(environmentVariables)
          .where(eq(environmentVariables.environmentId, activeEnv.id))
      : await db
          .select({ key: environmentVariables.key, value: environmentVariables.value })
          .from(environmentVariables)
          .where(eq(environmentVariables.userId, session.userId));

    if (userVars.length > 0) {
      const varMap = new Map(userVars.map((v) => [v.key, v.value]));
      const { resolved, unresolvedKeys } = resolveVariables(curl, varMap);
      resolvedCurl = resolved;
      if (unresolvedKeys.length > 0) {
        warning = `Unresolved variables: ${unresolvedKeys.join(", ")}`;
      }
    }
  } catch (err) {
    console.error("[POST /api/execute] Failed to load variables:", err);
    // Continue with original curl if variable loading fails
  }

  if (resolvedCurl.length > 50_000) {
    return NextResponse.json({ error: "curl command exceeds maximum length" }, { status: 400 });
  }

  const result = await executeCurl(resolvedCurl);

  // Clean up any temporary upload files referenced in the curl command
  cleanupTempFiles(resolvedCurl).catch(() => {});

  if (result.error && result.status === 0) {
    return NextResponse.json({ error: result.error, warning }, { status: 422 });
  }

  // Log execution in team context
  if (teamId) {
    // Extract method and URL from curl for the log entry
    let method = "GET";
    let url = "";
    try {
      const { parseCurl } = await import("@/lib/curl/parser");
      const parsed = parseCurl(curl);
      method = parsed.method;
      url = parsed.url;
    } catch {}
    logActivity(
      teamId,
      session.userId,
      "request.executed",
      "request",
      "",
      `${method} ${url}`,
      { status: result.status, timeMs: result.timeMs }
    );
  }

  return NextResponse.json({ ...result, warning });
}
