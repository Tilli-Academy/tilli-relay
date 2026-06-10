import { NextRequest } from "next/server";

/**
 * Extracts the client IP address from a request, accounting for reverse proxies.
 *
 * Set RELAY_TRUSTED_PROXY_HOPS to the number of trusted reverse proxies
 * between the client and this server (e.g., 1 for a single load balancer).
 * The client IP is read from x-forwarded-for counting that many entries
 * from the right — entries added by untrusted clients are ignored.
 *
 * When set to 0 (default), x-forwarded-for is not trusted and the
 * server falls back to x-real-ip or "unknown".
 */
export function getClientIp(req: NextRequest): string {
  const hops = parseInt(process.env.RELAY_TRUSTED_PROXY_HOPS || "0", 10) || 0;

  if (hops > 0) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
      // The client IP is at position (length - hops), which is the entry
      // added just before the first trusted proxy in the chain.
      const idx = parts.length - hops;
      if (idx >= 0 && parts[idx]) {
        return parts[idx];
      }
    }
  }

  return req.headers.get("x-real-ip") || "unknown";
}
