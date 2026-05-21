import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieFromRequest } from "@/lib/auth.edge";

const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/signup", "/api/share/"];

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow static assets, Next.js internals, and favicon
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") // static files (e.g. .js, .css, .png)
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Non-API routes (pages) are always allowed through.
  // Pages handle auth client-side via fetchUser() which uses proxy-aware URLs.
  // Server-side redirects break when behind a reverse proxy (e.g. code-server).
  if (!pathname.startsWith("/api/")) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Allow public API paths (login, signup)
  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    return applySecurityHeaders(NextResponse.next());
  }

  // For protected API routes, check for session cookie.
  // Actual Redis session verification happens in each route handler via getSession().
  const token = getSessionCookieFromRequest(req);
  if (!token) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    );
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
