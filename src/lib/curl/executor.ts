import { execFile } from "child_process";
import { ExecutionResult } from "@/lib/types";
import { sanitize } from "./sanitizer";

const DEFAULT_TIMEOUT_MS = 30_000;

// Delimiter used to separate response body from metadata
const META_DELIMITER = "\n__REQIFY_META__\n";

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

  const args = [
    ...sanitizeResult.sanitizedArgs,
    "-s", "-S",           // Silent mode with error reporting
    "-i",                 // Include response headers in output
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
