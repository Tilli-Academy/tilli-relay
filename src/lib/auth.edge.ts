/**
 * Edge-compatible auth utilities for middleware.
 * Does NOT import ioredis or any Node.js-only modules.
 * Session verification is done via an internal API call.
 */

const COOKIE_NAME = "reqify-session";

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
