import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { redis } from "./redis";

export const COOKIE_NAME = "relay-session";
export const SESSION_HEADER = "x-relay-session";
const SESSION_PREFIX = "session:";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

/** Bcrypt hash with 12 salt rounds (enterprise-grade). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Generate a cryptographically secure random token using Web Crypto API. */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cookie options shared by set and clear operations. */
function cookieOptions(maxAge: number): {
  path: string;
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
} {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    maxAge,
  };
}

/**
 * Create a Redis session and return the token.
 * The caller is responsible for including the token in the response
 * (both as a cookie and in the body for proxy environments).
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  await redis.set(`${SESSION_PREFIX}${token}`, userId, "EX", SESSION_TTL);
  return token;
}

/** Set the session cookie on a NextResponse. */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, cookieOptions(SESSION_TTL));
}

/** Clear the session cookie on a NextResponse. */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", cookieOptions(0));
}

/**
 * Read session token from cookie OR x-relay-session header.
 * The header fallback is needed because code-server proxy strips Set-Cookie
 * from proxied responses, so the browser never receives the cookie.
 */
export async function getSession(): Promise<{ userId: string } | null> {
  // Try cookie first
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    return verifySession(cookieToken);
  }

  // Fall back to x-relay-session header (for proxied environments)
  const headerStore = await headers();
  const headerToken = headerStore.get(SESSION_HEADER);
  if (headerToken) {
    return verifySession(headerToken);
  }

  return null;
}

/** Verify a session token against Redis. */
export async function verifySession(
  token: string
): Promise<{ userId: string } | null> {
  const userId = await redis.get(`${SESSION_PREFIX}${token}`);
  if (!userId) return null;
  return { userId };
}

/** Destroy session in Redis and clear cookie on response. */
export async function destroySession(response: NextResponse): Promise<NextResponse> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const token =
    cookieStore.get(COOKIE_NAME)?.value ||
    headerStore.get(SESSION_HEADER);
  if (token) {
    await redis.del(`${SESSION_PREFIX}${token}`);
  }
  clearSessionCookie(response);
  return response;
}

/**
 * Reads session token from a request — checks both cookie and header.
 * Used in middleware (edge runtime).
 */
export function getSessionTokenFromRequest(
  req: Request
): string | undefined {
  // Check x-relay-session header first (proxy-safe)
  const headerToken = req.headers.get(SESSION_HEADER);
  if (headerToken) return headerToken;

  // Fall back to cookie
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match?.split("=")[1];
}
