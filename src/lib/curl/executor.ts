import { execFile } from "child_process";
import { promises as dns } from "dns";
import { ExecutionResult } from "@/lib/types";
import { sanitize } from "./sanitizer";

const DEFAULT_TIMEOUT_MS = 30_000;

// Delimiter used to separate response body from metadata
const META_DELIMITER = "\n__RELAY_META__\n";

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

/**
 * Resolves hostname and checks if the IP is in a blocked range.
 * Returns error string if blocked, null if allowed.
 * Note: This checks only the initial URL. Redirect targets (via -L) are not
 * re-validated — --max-redirs limits the chain as a secondary defense.
 */
async function checkSSRF(args: string[]): Promise<string | null> {
  const url = args.find(a => a.startsWith("http://") || a.startsWith("https://"));
  if (!url) return null;

  const hostname = extractHostname(url);
  if (!hostname) return "Invalid URL: could not extract hostname";

  // In e2e test mode, allow localhost for mock server
  if (process.env.RELAY_E2E_ALLOW_LOCAL === "true") {
    if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  }

  // Configurable allowlist (if set, only these hosts are permitted)
  const allowedHosts = process.env.RELAY_ALLOWED_HOSTS;
  if (allowedHosts) {
    const allowed = allowedHosts.split(",").map(h => h.trim().toLowerCase());
    if (allowed.includes(hostname.toLowerCase())) return null;
    return `Host '${hostname}' is not in the allowed hosts list`;
  }

  // Configurable blocklist
  const blockedHosts = process.env.RELAY_BLOCKED_HOSTS;
  if (blockedHosts) {
    const blocked = blockedHosts.split(",").map(h => h.trim().toLowerCase());
    if (blocked.includes(hostname.toLowerCase())) {
      return `Host '${hostname}' is blocked`;
    }
  }

  // If hostname is already an IP literal, check directly
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(":")) {
    if (isBlockedIP(hostname)) {
      return "Requests to private/internal IP addresses are not allowed";
    }
    return null;
  }

  // Resolve DNS and check all resulting IPs
  try {
    const results = await dns.lookup(hostname, { all: true });
    for (const result of results) {
      if (isBlockedIP(result.address)) {
        return `Host '${hostname}' resolves to a private/internal IP address`;
      }
    }
  } catch (err) {
    return `DNS resolution failed for '${hostname}': ${(err as Error).message}`;
  }

  return null;
}

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
 * been done (e.g. after tokenize → variable substitution → sanitizeTokens).
 */
export async function executeCurlArgs(sanitizedArgs: string[]): Promise<ExecutionResult> {
  // SSRF check: resolve hostname and verify it's not a private/internal IP
  const ssrfError = await checkSSRF(sanitizedArgs);
  if (ssrfError) {
    return {
      status: 0,
      headers: {},
      body: "",
      timeMs: 0,
      error: ssrfError,
    };
  }

  const args = [
    ...sanitizedArgs,
    "-s", "-S",              // Silent mode with error reporting
    "-i",                    // Include response headers in output
    "--max-redirs", "5",     // Limit redirect chains (secondary SSRF defense)
    "--noproxy", "*",        // Ignore proxy env vars (prevents SSRF bypass via proxy)
    "-w", META_DELIMITER + "%{http_code}|%{time_total}",  // Append metadata
  ];

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

/**
 * Parses raw HTTP response (from curl -i) into headers and body.
 */
function parseRawResponse(raw: string): { headers: Record<string, string>; body: string } {
  const headers: Record<string, string> = {};

  // curl -i may include multiple header blocks (e.g., redirects).
  // Use lastIndexOf to find the final header/body boundary.
  const crlfSplit = raw.lastIndexOf("\r\n\r\n");
  if (crlfSplit !== -1) {
    const headerSection = raw.slice(0, crlfSplit);
    const body = raw.slice(crlfSplit + 4);
    // Parse only the last header block (after any redirect headers)
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
