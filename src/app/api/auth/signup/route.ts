import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { validateEmail, validatePassword } from "@/lib/validation";
import { handleAppError } from "@/lib/errors";
import { parseJsonBody } from "@/lib/request";

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await parseJsonBody(req);
  } catch (e) {
    return handleAppError(e);
  }

  const { email, password } = body;

  // Validate email
  const emailError = validateEmail(email);
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 400 });
  }

  // Validate password strength
  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({ email: normalizedEmail, passwordHash })
      .returning({ id: users.id, email: users.email });

    const token = await createSession(user.id);
    const response = NextResponse.json(
      { id: user.id, email: user.email, sessionToken: token },
      { status: 201 }
    );
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error("[POST /api/auth/signup]", err);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
