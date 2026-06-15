import { buildCurl } from "@/lib/curl/builder";
import { RequestState, HttpMethod, Header, AuthState, BodyType, FormDataField } from "@/lib/types";

// --- Postman Collection v2.1 types ---

interface PostmanCollection {
  info?: { name?: string; description?: string; schema?: string };
  item?: PostmanItem[];
  auth?: PostmanAuth;
}

interface PostmanItem {
  name?: string;
  request?: PostmanRequest;
  item?: PostmanItem[]; // nested folders
  auth?: PostmanAuth;   // folder-level auth
}

interface PostmanRequest {
  method?: string;
  url?: string | PostmanUrl;
  header?: Array<{ key: string; value: string; disabled?: boolean }>;
  body?: PostmanBody;
  auth?: PostmanAuth;
}

interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string | string[];
  path?: string | string[];
  query?: Array<{ key: string; value: string; disabled?: boolean }>;
}

interface PostmanBody {
  mode?: string;
  raw?: string;
  urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>;
  formdata?: Array<{ key: string; value: string; type?: string; disabled?: boolean }>;
}

interface PostmanAuth {
  type?: string;
  basic?: Array<{ key: string; value: string }>;
  bearer?: Array<{ key: string; value: string }>;
  apikey?: Array<{ key: string; value: string }>;
}

// --- Public types ---

export interface ImportedRequest {
  name: string;
  curl: string;
}

export interface ImportedCollection {
  name: string;
  description: string;
  requests: ImportedRequest[];
}

// --- Main entry ---

/**
 * Parses a Postman Collection v2.x JSON and converts all requests to curl commands.
 * Supports:
 *   - v2.0 and v2.1 schemas
 *   - Nested folders
 *   - Structured URL objects (host/path arrays, query params)
 *   - Raw, urlencoded, and formdata body modes
 *   - Auth inheritance (collection → folder → request)
 *   - Postman variables ({{var}}) passed through as-is
 */
export function parsePostmanCollection(json: PostmanCollection): ImportedCollection {
  const name = json.info?.name || "Imported Collection";
  const description = json.info?.description || "";
  const requests: ImportedRequest[] = [];

  const collectionAuth = json.auth || undefined;

  if (json.item) {
    flattenItems(json.item, requests, collectionAuth);
  }

  return { name, description, requests };
}

/**
 * Validates that the input looks like a Postman collection.
 * Returns an error message or null if valid.
 */
export function validatePostmanJson(json: unknown): string | null {
  if (!json || typeof json !== "object") {
    return "Expected a JSON object";
  }

  const obj = json as Record<string, unknown>;

  // Must have either info or item to be a collection
  if (!obj.info && !obj.item) {
    return "Not a valid Postman collection: missing 'info' and 'item' fields";
  }

  if (obj.item && !Array.isArray(obj.item)) {
    return "Not a valid Postman collection: 'item' must be an array";
  }

  return null;
}

// --- Internal helpers ---

function flattenItems(
  items: PostmanItem[],
  out: ImportedRequest[],
  inheritedAuth?: PostmanAuth
): void {
  for (const item of items) {
    // Folder-level auth overrides inherited auth
    const effectiveAuth = item.auth || inheritedAuth;

    if (item.item) {
      flattenItems(item.item, out, effectiveAuth);
    } else if (item.request) {
      const state = postmanRequestToState(item.request, effectiveAuth);
      out.push({
        name: item.name || "Untitled Request",
        curl: buildCurl(state),
      });
    }
  }
}

function postmanRequestToState(
  req: PostmanRequest,
  inheritedAuth?: PostmanAuth
): RequestState {
  const method = (req.method?.toUpperCase() as HttpMethod) || "GET";
  const { url, params } = resolveUrl(req.url);
  const headers: Header[] = resolveHeaders(req.header);
  const { body, bodyType, formData, contentTypeHeader } = resolveBody(req.body, method);
  const auth = parsePostmanAuth(req.auth || inheritedAuth);

  // Add Content-Type header from body mode if not already present
  if (contentTypeHeader) {
    const hasContentType = headers.some(
      (h) => h.key.toLowerCase() === "content-type" && h.enabled
    );
    if (!hasContentType) {
      headers.unshift({ key: "Content-Type", value: contentTypeHeader, enabled: true });
    }
  }

  return { method, url, headers, params, body, bodyType, formData, auth };
}

/**
 * Resolves a Postman URL (string or structured object) into a URL string and params array.
 */
function resolveUrl(url?: string | PostmanUrl): { url: string; params: Header[] } {
  if (!url) return { url: "", params: [] };
  if (typeof url === "string") {
    // Extract query params from raw URL string
    const qIdx = url.indexOf("?");
    if (qIdx === -1) return { url, params: [] };
    const baseUrl = url.slice(0, qIdx);
    const queryStr = url.slice(qIdx + 1);
    const params: Header[] = queryStr.split("&").filter(Boolean).map((pair) => {
      const eqIdx = pair.indexOf("=");
      if (eqIdx !== -1) {
        return { key: pair.slice(0, eqIdx), value: pair.slice(eqIdx + 1), enabled: true };
      }
      return { key: pair, value: "", enabled: true };
    });
    return { url: baseUrl, params };
  }

  // If no structured parts, fall back to raw
  if (!url.protocol && !url.host && !url.path) {
    if (url.raw) {
      // Parse raw as string URL
      const qIdx = url.raw.indexOf("?");
      if (qIdx === -1) return { url: url.raw, params: [] };
      const baseUrl = url.raw.slice(0, qIdx);
      const queryStr = url.raw.slice(qIdx + 1);
      const rawParams: Header[] = queryStr.split("&").filter(Boolean).map((pair) => {
        const eqIdx = pair.indexOf("=");
        if (eqIdx !== -1) {
          return { key: pair.slice(0, eqIdx), value: pair.slice(eqIdx + 1), enabled: true };
        }
        return { key: pair, value: "", enabled: true };
      });
      // Merge with structured query params if present
      const structuredParams: Header[] = (url.query || []).map((q) => ({
        key: q.key || "",
        value: q.value || "",
        enabled: !q.disabled,
      }));
      return { url: baseUrl, params: structuredParams.length > 0 ? structuredParams : rawParams };
    }
    return { url: "", params: [] };
  }

  // Build from structured parts
  let result = "";

  if (url.protocol) {
    result += url.protocol + "://";
  }

  if (url.host) {
    result += Array.isArray(url.host) ? url.host.join(".") : url.host;
  }

  if (url.path) {
    const pathStr = Array.isArray(url.path) ? url.path.join("/") : url.path;
    if (pathStr && !pathStr.startsWith("/")) {
      result += "/";
    }
    result += pathStr;
  }

  // Extract query parameters as structured params
  const params: Header[] = (url.query || []).map((q) => ({
    key: q.key || "",
    value: q.value || "",
    enabled: !q.disabled,
  }));

  return { url: result, params };
}

function resolveHeaders(
  headers?: Array<{ key: string; value: string; disabled?: boolean }>
): Header[] {
  if (!headers) return [];
  return headers.map((h) => ({
    key: h.key || "",
    value: h.value || "",
    enabled: !h.disabled,
  }));
}

/**
 * Resolves body from different Postman body modes.
 * Returns the body string and an optional Content-Type header to add.
 */
function resolveBody(
  body?: PostmanBody,
  method?: string
): { body: string; bodyType: BodyType; formData: FormDataField[]; contentTypeHeader: string | null } {
  const empty = { body: "", bodyType: "none" as BodyType, formData: [], contentTypeHeader: null };
  if (!body || method === "GET") {
    return empty;
  }

  switch (body.mode) {
    case "raw":
      return { body: body.raw || "", bodyType: "text", formData: [], contentTypeHeader: null };

    case "urlencoded": {
      if (!body.urlencoded) return empty;
      const pairs = body.urlencoded
        .filter((p) => !p.disabled)
        .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
        .join("&");
      return {
        body: pairs,
        bodyType: "text",
        formData: [],
        contentTypeHeader: "application/x-www-form-urlencoded",
      };
    }

    case "formdata": {
      if (!body.formdata) return empty;
      const fields: FormDataField[] = body.formdata
        .filter((f) => !f.disabled)
        .map((f) => ({
          key: f.key || "",
          value: f.value || "",
          type: (f.type === "file" ? "file" : "text") as "text" | "file",
          enabled: true,
          fileName: f.type === "file" ? (f.value || "").split("/").pop() || "" : undefined,
        }));
      return {
        body: "",
        bodyType: "form-data",
        formData: fields,
        contentTypeHeader: null,
      };
    }

    default:
      return { body: body.raw || "", bodyType: "text", formData: [], contentTypeHeader: null };
  }
}

function parsePostmanAuth(auth?: PostmanAuth): AuthState {
  if (!auth?.type) return { type: "none" };

  switch (auth.type) {
    case "basic": {
      const username = findAuthValue(auth.basic, "username");
      const password = findAuthValue(auth.basic, "password");
      return { type: "basic", basic: { username, password } };
    }
    case "bearer": {
      const token = findAuthValue(auth.bearer, "token");
      return { type: "bearer", bearer: { token } };
    }
    case "apikey": {
      const key = findAuthValue(auth.apikey, "key");
      const value = findAuthValue(auth.apikey, "value");
      const addTo =
        findAuthValue(auth.apikey, "in") === "query" ? "query" : "header";
      return { type: "apikey", apikey: { key, value, addTo } };
    }
    default:
      return { type: "none" };
  }
}

function findAuthValue(
  arr?: Array<{ key: string; value: string }>,
  key?: string
): string {
  if (!arr || !key) return "";
  return arr.find((e) => e.key === key)?.value || "";
}
