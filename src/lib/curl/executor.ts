import { execFile } from "child_process";
import { promises as dns } from "dns";
import { ExecutionResult } from "@/lib/types";
import { sanitize } from "./sanitizer";

const DEFAULT_TIMEOUT_MS = 30_000;

// Delimiter used to separate response body from metadata
const META_DELIMITER = "\n__RELAY_META__\n";

/** Maximum number of redirect hops we follow manually */
const MAX_REDIRECTS = 5;

/** HTTP status codes that indicate a redirect */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// ─── SSRF Protection ────────────────────────────────────────────────────────

/** IPv4 ranges that are blocked (private, loopback, link-local, metadata) */
const BLOCKED_IPV4_RANGES = [
  { start: ip4ToNum("0.0.0.0"),       end: ip4ToNum("0.255.255.255") },
  { start: ip4ToNum("10.0.0.0"),      end: ip4ToNum("10.255.255.255") },
  { start: ip4ToNum("100.64.0.0"),    end: ip4ToNum("100.127.255.255") },
  { start: ip4ToNum("127.0.0.0"),     end: ip4ToNum("127.255.255.255") },
  { start: ip4ToNum("169.254.0.0"),   end: ip4ToNum("169.254.255.255") },
  { start: ip4ToNum("172.16.0.0"),    end: ip4ToNum("172.31.255.255") },
  { start: ip4ToNum("192.0.0.0"),     end: ip4ToNum("192.0.0.255") },
  { start: ip4ToNum("192.168.0.0"),   end: ip4ToNum("192.168.255.255") },
  { start: ip4ToNum("198.18.0.0"),    end: ip4ToNum("198.19.255.255") },
];

function ip4ToNum(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isBlockedIPv4(ip: string): boolean {
  const num = ip4ToNum(ip);
  return BLOCKED_IPV4_RANGES.some(r => num >= r.start && num <= r.end);
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  return ["fc", "fd", "fe80"].some(prefix => normalized.startsWith(prefix));
}

function isBlockedIP(ip: string): boolean {
  return ip.includes(":") ? isBlockedIPv6(ip) : isBlockedIPv4(ip);
}

function extractHostname(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    // Strip brackets from IPv6 addresses (URL parser includes them)
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      return hostname.slice(1, -1);
    }
    return hostname;
  } catch {
    return null;
  }
}

/** Extracts the port from a URL (explicit port or protocol default). */
function extractPort(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  } catch {
    return "80";
  }
}

// ─── DNS resolution + IP pinning ────────────────────────────────────────────

interface PinInfo {
  hostname: string;
  port: string;
  pinnedIP: string;
}

/**
 * Resolves hostname, validates every resulting IP against the blocklist,
 * and returns pinning info so curl connects to exactly the validated IP.
 *
 * Returns PinInfo for DNS hostnames (curl must use --resolve to pin),
 * or null for IP literals and explicitly-allowed hosts where pinning is
 * unnecessary.
 *
 * Throws a descriptive error string if the host is blocked or DNS fails.
 */
async function resolveAndValidateHost(url: string): Promise<PinInfo | null> {
  const hostname = extractHostname(url);
  if (!hostname) throw "Invalid URL: could not extract hostname";

  // In e2e test mode, allow localhost for mock server
  if (process.env.RELAY_E2E_ALLOW_LOCAL === "true") {
    if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  }

  // Configurable allowlist (if set, only these hosts are permitted)
  const allowedHosts = process.env.RELAY_ALLOWED_HOSTS;
  if (allowedHosts) {
    const allowed = allowedHosts.split(",").map(h => h.trim().toLowerCase());
    if (allowed.includes(hostname.toLowerCase())) return null;
    throw `Host '${hostname}' is not in the allowed hosts list`;
  }

  // Configurable blocklist
  const blockedHosts = process.env.RELAY_BLOCKED_HOSTS;
  if (blockedHosts) {
    const blocked = blockedHosts.split(",").map(h => h.trim().toLowerCase());
    if (blocked.includes(hostname.toLowerCase())) {
      throw `Host '${hostname}' is blocked`;
    }
  }

  // If hostname is already an IP literal, check directly (no DNS to pin)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(":")) {
    if (isBlockedIP(hostname)) {
      throw "Requests to private/internal IP addresses are not allowed";
    }
    return null;
  }

  // Resolve DNS and check all resulting IPs
  let results: { address: string; family: number }[];
  try {
    results = await dns.lookup(hostname, { all: true });
  } catch (err) {
    throw `DNS resolution failed for '${hostname}': ${(err as Error).message}`;
  }

  if (results.length === 0) {
    throw `DNS resolution returned no addresses for '${hostname}'`;
  }

  for (const result of results) {
    if (isBlockedIP(result.address)) {
      throw `Host '${hostname}' resolves to a private/internal IP address`;
    }
  }

  // Pick the first IPv4 address for pinning (prefer IPv4 for compatibility)
  const ipv4 = results.find(r => r.family === 4);
  const pinnedIP = ipv4 ? ipv4.address : results[0].address;
  const port = extractPort(url);

  return { hostname, port, pinnedIP };
}

// ─── Redirect helpers ───────────────────────────────────────────────────────

/**
 * Strips -L / --location from args so curl never follows redirects itself.
 * Returns whether the flag was present (so we know to follow manually).
 */
function extractRedirectFlag(args: string[]): { cleanArgs: string[]; followRedirects: boolean } {
  let followRedirects = false;
  const cleanArgs = args.filter(a => {
    if (a === "-L" || a === "--location") {
      followRedirects = true;
      return false;
    }
    return true;
  });
  return { cleanArgs, followRedirects };
}

/**
 * Resolves a Location header (possibly relative) against the current URL.
 */
function resolveRedirectUrl(location: string, currentUrl: string): string {
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return location;
  }
}

/** Finds the URL token in a curl args array. */
function findUrl(args: string[]): string | undefined {
  return args.find(a => a.startsWith("http://") || a.startsWith("https://"));
}

/** Replaces the URL token in a curl args array. */
function replaceUrl(args: string[], newUrl: string): string[] {
  return args.map(a => (a.startsWith("http://") || a.startsWith("https://")) ? newUrl : a);
}

/**
 * Adjusts args when following a redirect.
 *
 * 307/308: preserve method and body (exact replay).
 * 301/302/303: switch to GET and drop the request body, matching standard
 * curl -L and browser behaviour.
 */
function adjustArgsForRedirect(args: string[], statusCode: number): string[] {
  // 307/308 preserve method and body
  if (statusCode === 307 || statusCode === 308) return [...args];

  // 301/302/303: switch to GET, drop request body
  const result: string[] = [];
  const bodyFlags = new Set(["-d", "--data", "--data-raw", "--data-binary", "-F", "--form"]);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    // Drop body flags that consume a separate value token
    if (bodyFlags.has(a)) {
      i++; // skip value
      continue;
    }
    // Drop --flag=value body flags
    const eqIdx = a.indexOf("=");
    if (eqIdx !== -1 && bodyFlags.has(a.slice(0, eqIdx))) {
      continue;
    }

    // Change explicit method to GET
    if (a === "-X" || a === "--request") {
      result.push(a);
      if (i + 1 < args.length) i++; // skip original method value
      result.push("GET");
      continue;
    }
    if (a.startsWith("--request=")) {
      result.push("--request=GET");
      continue;
    }

    result.push(a);
  }

  return result;
}

// ─── Build final curl args ──────────────────────────────────────────────────

/**
 * Builds the final curl argv for a single hop, injecting --resolve when we
 * have a pinned IP from DNS validation.
 */
function buildCurlWithPinnedIP(
  args: string[],
  pin: PinInfo | null,
): string[] {
  const pinArgs = pin
    ? ["--resolve", `${pin.hostname}:${pin.port}:${pin.pinnedIP}`]
    : [];

  return [
    ...pinArgs,
    ...args,
    "-s", "-S",              // Silent mode with error reporting
    "-i",                    // Include response headers in output
    "--noproxy", "*",        // Ignore proxy env vars (prevents SSRF bypass via proxy)
    "-w", META_DELIMITER + "%{http_code}|%{time_total}",  // Append metadata
  ];
}

// ─── Execution ──────────────────────────────────────────────────────────────

/**
 * Executes a curl command server-side.
 * Uses execFile (no shell) for security.
 */
export async function executeCurl(curlCommand: string): Promise<ExecutionResult> {
  const sanitizeResult = sanitize(curlCommand);

  if (!sanitizeResult.valid) {
    return {
      status: 0,
      headers: {},
      body: "",
      timeMs: 0,
      error: sanitizeResult.error,
    };
  }

  return executeCurlArgs(sanitizeResult.sanitizedArgs);
}

/**
 * Executes pre-sanitized curl args. Use this when sanitization has already
 * been done (e.g. after tokenize -> variable substitution -> sanitizeTokens).
 *
 * Redirect following (-L) is intercepted and performed manually so that
 * every hop is re-validated against the SSRF blocklist.  DNS results are
 * pinned into the curl invocation via --resolve to prevent TOCTOU / DNS
 * rebinding attacks.
 */
export async function executeCurlArgs(sanitizedArgs: string[]): Promise<ExecutionResult> {
  // Strip -L; we follow redirects ourselves so we can re-validate each hop
  const { cleanArgs, followRedirects } = extractRedirectFlag(sanitizedArgs);

  let currentArgs = cleanArgs;
  let totalTimeMs = 0;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = findUrl(currentArgs);
    if (!url) {
      return { status: 0, headers: {}, body: "", timeMs: totalTimeMs, error: "No URL found in curl args" };
    }

    // Resolve DNS, validate against blocklist, get IP to pin
    let pin: PinInfo | null;
    try {
      pin = await resolveAndValidateHost(url);
    } catch (err) {
      const prefix = hop > 0 ? "Redirect blocked: " : "";
      return { status: 0, headers: {}, body: "", timeMs: totalTimeMs, error: `${prefix}${err}` };
    }

    const execArgs = buildCurlWithPinnedIP(currentArgs, pin);
    const hopResult = await execCurlOnce(execArgs);
    totalTimeMs += hopResult.timeMs;

    // If caller didn't request -L, or this isn't a redirect, we're done
    if (!followRedirects || !REDIRECT_STATUSES.has(hopResult.status)) {
      hopResult.timeMs = totalTimeMs;
      return hopResult;
    }

    // Extract Location header (case-insensitive lookup)
    const location = hopResult.headers["Location"] || hopResult.headers["location"];
    if (!location) {
      // Redirect status but no Location — return as-is
      hopResult.timeMs = totalTimeMs;
      return hopResult;
    }

    const nextUrl = resolveRedirectUrl(location, url);

    // Validate redirect target protocol
    if (!nextUrl.startsWith("http://") && !nextUrl.startsWith("https://")) {
      return {
        status: 0, headers: {}, body: "", timeMs: totalTimeMs,
        error: `Redirect to disallowed protocol: ${nextUrl}`,
      };
    }

    // Prepare args for next hop (may change method on 301/302/303)
    currentArgs = replaceUrl(
      adjustArgsForRedirect(currentArgs, hopResult.status),
      nextUrl,
    );
  }

  return {
    status: 0, headers: {}, body: "", timeMs: totalTimeMs,
    error: `Too many redirects (max ${MAX_REDIRECTS})`,
  };
}

// ─── Single-hop execution ───────────────────────────────────────────────────

/**
 * Runs a single curl invocation (no redirect following).
 */
function execCurlOnce(args: string[]): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    execFile("curl", args, { timeout: DEFAULT_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        resolve({
          status: 0,
          headers: {},
          body: "",
          timeMs: 0,
          error: stderr || error.message,
        });
        return;
      }

      const output = stdout;
      const metaIdx = output.lastIndexOf(META_DELIMITER);

      let rawResponse: string;
      let statusCode = 0;
      let timeMs = 0;

      if (metaIdx !== -1) {
        rawResponse = output.slice(0, metaIdx);
        const metaStr = output.slice(metaIdx + META_DELIMITER.length).trim();
        const [code, time] = metaStr.split("|");
        statusCode = parseInt(code, 10) || 0;
        timeMs = Math.round(parseFloat(time || "0") * 1000);
      } else {
        rawResponse = output;
      }

      // Split headers from body (HTTP response with -i flag)
      const { headers, body } = parseRawResponse(rawResponse);

      // Prefer the status from -w over parsed headers
      resolve({
        status: statusCode,
        headers,
        body,
        timeMs,
        error: stderr || undefined,
      });
    });
  });
}

// ─── Response parsing ───────────────────────────────────────────────────────

/**
 * Parses raw HTTP response (from curl -i) into headers and body.
 */
function parseRawResponse(raw: string): { headers: Record<string, string>; body: string } {
  const headers: Record<string, string> = {};

  // curl -i may include multiple header blocks (e.g., 100 Continue).
  // Use lastIndexOf to find the final header/body boundary.
  const crlfSplit = raw.lastIndexOf("\r\n\r\n");
  if (crlfSplit !== -1) {
    const headerSection = raw.slice(0, crlfSplit);
    const body = raw.slice(crlfSplit + 4);
    // Parse only the last header block (after any 1xx headers)
    const lastStatusLine = headerSection.lastIndexOf("HTTP/");
    const relevantHeaders = lastStatusLine !== -1 ? headerSection.slice(lastStatusLine) : headerSection;
    parseHeaderSection(relevantHeaders, headers);
    return { headers, body };
  }

  // Try with plain \n\n
  const lfSplit = raw.lastIndexOf("\n\n");
  if (lfSplit !== -1) {
    const headerSection = raw.slice(0, lfSplit);
    const body = raw.slice(lfSplit + 2);
    const lastStatusLine = headerSection.lastIndexOf("HTTP/");
    const relevantHeaders = lastStatusLine !== -1 ? headerSection.slice(lastStatusLine) : headerSection;
    parseHeaderSection(relevantHeaders, headers);
    return { headers, body };
  }

  return { headers, body: raw };
}

function parseHeaderSection(section: string, headers: Record<string, string>): void {
  const lines = section.split(/\r?\n/);
  for (const line of lines) {
    // Skip status line (HTTP/1.1 200 OK)
    if (line.startsWith("HTTP/")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      headers[key] = value;
    }
  }
}
