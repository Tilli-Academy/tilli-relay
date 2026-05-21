import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redis } from "./redis";

export const COOKIE_NAME = "reqify-session";
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

/** Build Set-Cookie header value for the session cookie. */
function buildSessionCookie(token: string, maxAge: number): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Create a Redis session and return the Set-Cookie header value. */
export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  await redis.set(`${SESSION_PREFIX}${token}`, userId, "EX", SESSION_TTL);
  return buildSessionCookie(token, SESSION_TTL);
}

/** Attach session cookie to a NextResponse. */
export function setSessionCookie(response: NextResponse, setCookieHeader: string): NextResponse {
  response.headers.set("Set-Cookie", setCookieHeader);
  return response;
}

/** Read session cookie, look up in Redis, return userId or null. */
export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Verify a session token against Redis. */
export async function verifySession(
  token: string
): Promise<{ userId: string } | null> {
  const userId = await redis.get(`${SESSION_PREFIX}${token}`);
  if (!userId) return null;
  return { userId };
}

/** Destroy session: delete from Redis and return the Set-Cookie header to clear it. */
export async function destroySession(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await redis.del(`${SESSION_PREFIX}${token}`);
  }
  return buildSessionCookie("", 0);
}

/** Reads session cookie from a request's Cookie header (for middleware). */
export function getSessionCookieFromRequest(
  req: Request
): string | undefined {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match?.split("=")[1];
}
