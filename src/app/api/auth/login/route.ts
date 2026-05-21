import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // Rate limit: 5 attempts per minute per IP
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(`login:${ip}`, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email", code: "USER_NOT_FOUND" },
        { status: 401 }
      );
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Incorrect password", code: "WRONG_PASSWORD" },
        { status: 401 }
      );
    }

    const cookieHeader = await createSession(user.id);
    const response = NextResponse.json({ id: user.id, email: user.email });
    return setSessionCookie(response, cookieHeader);
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
