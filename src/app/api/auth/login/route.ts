import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";
import { handleAppError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/request";

export async function POST(req: NextRequest) {
  // Rate limit: 20 attempts per minute per IP
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`login:${ip}`, 20, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (e) {
    return handleAppError(e);
  }

  const { email, password } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    // Constant-time: always run bcrypt to prevent timing-based user enumeration
    const DUMMY_HASH = "$2b$12$000000000000000000000000000000000000000000000000000000";
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create session and get the token
    const token = await createSession(user.id);

    // Build response with token in body (for proxy environments where
    // Set-Cookie is stripped) AND as a cookie (for direct access)
    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      sessionToken: token,
    });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
