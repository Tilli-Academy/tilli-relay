import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

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
  const base = req.url.replace(/\/api\/auth\/login-form$/, "");
  return NextResponse.redirect(base + path, 303);
}

/**
 * Handles native HTML form POST for login.
 * On success: redirects to /
 * On failure: redirects back to /login?error=<message>
 */
export async function POST(req: NextRequest) {
  // Rate limit: 5 attempts per minute per IP
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`login:${ip}`, 10, 60);
  if (!rl.allowed) {
    return redirectTo("/login?error=" + encodeURIComponent("Too many login attempts. Try again later."), req);
  }

  const formData = await req.formData();
  const email = (formData.get("email") as string || "").trim().toLowerCase();
  const password = formData.get("password") as string || "";

  if (!email || !password) {
    return redirectTo("/login?error=" + encodeURIComponent("Email and password are required"), req);
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return redirectTo("/login?error=" + encodeURIComponent("Invalid email or password"), req);
    }

    const token = await createSession(user.id);
    const response = redirectTo("/", req);
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error("[POST /api/auth/login-form]", err);
    return redirectTo("/login?error=" + encodeURIComponent("Login failed. Please try again."), req);
  }
}
