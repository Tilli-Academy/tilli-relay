/**
 * Detects the base path for API calls.
 * Handles code-server proxy URLs like /proxy/3002/
 */
export function getApiBase(): string {
  if (typeof window === "undefined") return "";
  const match = window.location.pathname.match(/^(\/proxy\/\d+)/);
  return match ? match[1] : "";
}

export function api(path: string): string {
  return `${getApiBase()}${path}`;
}

// --- Session token management for proxy environments ---
// Code-server proxy strips Set-Cookie headers, so we store the session token
// in localStorage and send it via x-relay-session header on every request.

const SESSION_STORAGE_KEY = "relay-session-token";
const SESSION_HEADER = "x-relay-session";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

export function setSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_STORAGE_KEY, token);
}

export function clearSessionToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/** Returns headers object with session token if available. */
export function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { [SESSION_HEADER]: token } : {};
}

/**
 * Fetch wrapper that automatically includes the session token header
 * and credentials: "include" for cookie fallback.
 */
export function authFetch(url: string, opts?: RequestInit): Promise<Response> {
  const mergedHeaders: Record<string, string> = {
    ...authHeaders(),
  };
  // Merge any existing headers from opts
  if (opts?.headers) {
    if (opts.headers instanceof Headers) {
      opts.headers.forEach((v, k) => { mergedHeaders[k] = v; });
    } else if (Array.isArray(opts.headers)) {
      opts.headers.forEach(([k, v]) => { mergedHeaders[k] = v; });
    } else {
      Object.assign(mergedHeaders, opts.headers);
    }
  }
  return fetch(url, { ...opts, headers: mergedHeaders, credentials: "include" });
}
