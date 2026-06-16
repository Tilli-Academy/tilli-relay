/**
 * Local mock HTTP server that mirrors httpbin.org endpoints.
 * Eliminates external dependency on httpbin.org for e2e tests.
 *
 * Endpoints:
 *   GET    /get          — echo request info as JSON
 *   POST   /post         — echo request info + body as JSON
 *   PUT    /put          — echo request info + body as JSON
 *   DELETE /delete       — echo request info as JSON
 *   PATCH  /patch        — echo request info + body as JSON
 *   GET    /html         — return sample HTML page
 *   GET    /delay/:n     — delay n seconds then return JSON
 *   ANY    /status/:code — return given HTTP status code
 *   GET    /redirect/:n  — redirect n times then return JSON
 *   GET    /headers      — echo request headers
 *   GET    /ssrf/redirect-to-metadata — 302 → http://169.254.169.254/...
 *   GET    /ssrf/redirect-to-private  — 302 → http://10.0.0.1/internal
 *   GET    /ssrf/redirect-to-file     — 302 → file:///etc/passwd
 */

import http from "http";

export const MOCK_PORT = 9444;
export const MOCK_BASE = `http://localhost:${MOCK_PORT}`;

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

function jsonResponse(
  res: http.ServerResponse,
  status: number,
  data: unknown,
) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function echoResponse(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  rawBody: string,
) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const args: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    args[k] = v;
  });

  const headers: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (typeof val === "string") headers[key] = val;
    else if (Array.isArray(val)) headers[key] = val.join(", ");
  }

  let json: unknown = null;
  try {
    json = JSON.parse(rawBody);
  } catch {
    // not JSON
  }

  const data: Record<string, unknown> = {
    args,
    headers,
    origin: req.socket.remoteAddress || "127.0.0.1",
    url: url.toString(),
  };

  if (rawBody) {
    data.data = rawBody;
    if (json) data.json = json;
  }

  jsonResponse(res, 200, data);
}

const HTML_PAGE = `<!DOCTYPE html>
<html><head><title>Mock HTML</title></head>
<body><h1>Herman Melville - Moby Dick</h1>
<p>Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse.</p>
</body></html>`;

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = (req.method || "GET").toUpperCase();

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    });
    res.end();
    return;
  }

  const rawBody = await parseBody(req);

  // /get
  if (pathname === "/get" && method === "GET") {
    return echoResponse(req, res, rawBody);
  }

  // /post
  if (pathname === "/post" && method === "POST") {
    return echoResponse(req, res, rawBody);
  }

  // /put
  if (pathname === "/put" && method === "PUT") {
    return echoResponse(req, res, rawBody);
  }

  // /delete
  if (pathname === "/delete" && method === "DELETE") {
    return echoResponse(req, res, rawBody);
  }

  // /patch
  if (pathname === "/patch" && method === "PATCH") {
    return echoResponse(req, res, rawBody);
  }

  // /html
  if (pathname === "/html") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": Buffer.byteLength(HTML_PAGE),
    });
    res.end(HTML_PAGE);
    return;
  }

  // /headers
  if (pathname === "/headers") {
    const headers: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (typeof val === "string") headers[key] = val;
    }
    jsonResponse(res, 200, { headers });
    return;
  }

  // /delay/:n
  const delayMatch = pathname.match(/^\/delay\/(\d+)$/);
  if (delayMatch) {
    const seconds = Math.min(parseInt(delayMatch[1], 10), 10);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return echoResponse(req, res, rawBody);
  }

  // /status/:code
  const statusMatch = pathname.match(/^\/status\/(\d+)$/);
  if (statusMatch) {
    const code = parseInt(statusMatch[1], 10);
    if (code === 204) {
      res.writeHead(204);
      res.end();
    } else if (code === 418) {
      jsonResponse(res, 418, { message: "I'm a teapot" });
    } else {
      jsonResponse(res, code, { status: code });
    }
    return;
  }

  // ── SSRF redirect test endpoints ──

  // /ssrf/redirect-to-metadata — 302 to cloud metadata IP
  if (pathname === "/ssrf/redirect-to-metadata") {
    res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
    res.end();
    return;
  }

  // /ssrf/redirect-to-private — 302 to private class-A IP
  if (pathname === "/ssrf/redirect-to-private") {
    res.writeHead(302, { Location: "http://10.0.0.1/internal" });
    res.end();
    return;
  }

  // /ssrf/redirect-to-file — 302 to file:// protocol
  if (pathname === "/ssrf/redirect-to-file") {
    res.writeHead(302, { Location: "file:///etc/passwd" });
    res.end();
    return;
  }

  // /redirect/:n
  const redirectMatch = pathname.match(/^\/redirect\/(\d+)$/);
  if (redirectMatch) {
    const n = parseInt(redirectMatch[1], 10);
    if (n > 1) {
      res.writeHead(302, { Location: `/redirect/${n - 1}` });
      res.end();
    } else if (n === 1) {
      res.writeHead(302, { Location: "/get" });
      res.end();
    } else {
      return echoResponse(req, res, rawBody);
    }
    return;
  }

  // Fallback 404
  jsonResponse(res, 404, { error: "Not Found", path: pathname });
}

let server: http.Server | null = null;

export function startMockServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server = http.createServer(handleRequest);
    server.listen(MOCK_PORT, "0.0.0.0", () => {
      console.log(`  [mock-server] Running on http://localhost:${MOCK_PORT}`);
      resolve();
    });
    server.on("error", reject);
  });
}

export function stopMockServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

// Allow running standalone: npx tsx e2e/mock-server.ts
if (require.main === module) {
  startMockServer();
}
