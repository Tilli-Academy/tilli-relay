/**
 * Edge-compatible auth utilities for middleware.
 * Does NOT import ioredis or any Node.js-only modules.
 * Session verification is done via an internal API call.
 */

const COOKIE_NAME = "relay-session";
const SESSION_HEADER = "x-relay-session";

/** Reads session token from request — checks header first, then cookie. */
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
