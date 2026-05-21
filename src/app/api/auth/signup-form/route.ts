import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { validateEmail, validatePassword } from "@/lib/validation";

function redirectTo(path: string, req: NextRequest): NextResponse {
  // Use Referer or Origin to preserve the proxy prefix (e.g. /proxy/3002)
  const referer = req.headers.get("referer") || req.headers.get("origin");
  if (referer) {
    try {
      const refUrl = new URL(referer);
      const proxyMatch = refUrl.pathname.match(/^(\/proxy\/\d+)/);
      if (proxyMatch) {
        return NextResponse.redirect(new URL(proxyMatch[1] + path, refUrl.origin), 303);
      }
      return NextResponse.redirect(new URL(path, refUrl.origin), 303);
    } catch {}
  }
  // Fallback: use req.url
  const base = req.url.replace(/\/api\/auth\/signup-form$/, "");
  return NextResponse.redirect(base + path, 303);
}

/**
 * Handles native HTML form POST for signup.
 * On success: redirects to /
 * On failure: redirects back to /login?mode=signup&error=<message>
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const email = (formData.get("email") as string || "").trim().toLowerCase();
  const password = formData.get("password") as string || "";
  const confirmPassword = formData.get("confirmPassword") as string || "";

  const emailErr = validateEmail(email);
  if (emailErr) {
    return redirectTo("/login?mode=signup&error=" + encodeURIComponent(emailErr), req);
  }

  const passErr = validatePassword(password);
  if (passErr) {
    return redirectTo("/login?mode=signup&error=" + encodeURIComponent(passErr), req);
  }

  if (password !== confirmPassword) {
    return redirectTo("/login?mode=signup&error=" + encodeURIComponent("Passwords do not match"), req);
  }

  try {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return redirectTo("/login?mode=signup&error=" + encodeURIComponent("An account with this email already exists"), req);
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id });

    const cookieHeader = await createSession(user.id);
    const response = redirectTo("/", req);
    return setSessionCookie(response, cookieHeader);
  } catch (err) {
    console.error("[POST /api/auth/signup-form]", err);
    return redirectTo("/login?mode=signup&error=" + encodeURIComponent("Signup failed. Please try again."), req);
  }
}
