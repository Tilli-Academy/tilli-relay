import { parseCurl } from "@/lib/curl/parser";
import { RequestState } from "@/lib/types";

interface ExportRequest {
  name: string;
  curl: string;
}

interface ExportCollection {
  name: string;
  description?: string | null;
  requests: ExportRequest[];
}

// --- Postman Collection v2.1 Export ---

interface PostmanHeader {
  key: string;
  value: string;
  disabled: boolean;
}

interface PostmanBodyRaw {
  mode: "raw";
  raw: string;
  options?: { raw: { language: string } };
}

interface PostmanBodyFormdata {
  mode: "formdata";
  formdata: Array<{ key: string; value: string; type: string; disabled: boolean }>;
}

type PostmanBody = PostmanBodyRaw | PostmanBodyFormdata;

interface PostmanAuth {
  type: string;
  basic?: Array<{ key: string; value: string; type: string }>;
  bearer?: Array<{ key: string; value: string; type: string }>;
  apikey?: Array<{ key: string; value: string; type: string }>;
}

interface PostmanRequestObj {
  method: string;
  header: PostmanHeader[];
  url: { raw: string; protocol: string; host: string[]; port?: string; path: string[]; query: Array<{ key: string; value: string; disabled: boolean }> };
  body?: PostmanBody;
  auth?: PostmanAuth;
}

interface PostmanItem {
  name: string;
  request: PostmanRequestObj;
}

interface PostmanCollectionExport {
  info: {
    name: string;
    description: string;
    schema: string;
  };
  item: PostmanItem[];
}

function stateToPostmanRequest(name: string, state: RequestState): PostmanItem {
  // URL parsing
  let protocol = "https";
  let hostPath = state.url;
  if (state.url.startsWith("http://")) {
    protocol = "http";
    hostPath = state.url.slice(7);
  } else if (state.url.startsWith("https://")) {
    protocol = "https";
    hostPath = state.url.slice(8);
  }

  const [hostPart, ...pathParts] = hostPath.split("/");
  // Separate host from port (e.g. "localhost:3000" → host=["localhost"], port="3000")
  const colonIdx = hostPart.indexOf(":");
  const hostWithoutPort = colonIdx !== -1 ? hostPart.slice(0, colonIdx) : hostPart;
  const port = colonIdx !== -1 ? hostPart.slice(colonIdx + 1) : undefined;
  const host = hostWithoutPort ? hostWithoutPort.split(".") : [];
  const path = pathParts.length > 0 ? pathParts : [];

  // Headers
  const headers: PostmanHeader[] = state.headers
    .filter((h) => h.key.trim())
    .map((h) => ({ key: h.key, value: h.value, disabled: !h.enabled }));

  // Query params
  const query = state.params
    .filter((p) => p.key.trim())
    .map((p) => ({ key: p.key, value: p.value, disabled: !p.enabled }));

  // Body
  let body: PostmanBody | undefined;
  if (state.bodyType === "json" && state.body) {
    body = {
      mode: "raw",
      raw: state.body,
      options: { raw: { language: "json" } },
    };
  } else if (state.bodyType === "text" && state.body) {
    body = { mode: "raw", raw: state.body };
  } else if (state.bodyType === "form-data" && state.formData.length > 0) {
    body = {
      mode: "formdata",
      formdata: state.formData
        .filter((f) => f.key.trim())
        .map((f) => ({ key: f.key, value: f.value, type: f.type, disabled: !f.enabled })),
    };
  }

  // Auth
  let auth: PostmanAuth | undefined;
  if (state.auth.type === "basic" && state.auth.basic) {
    auth = {
      type: "basic",
      basic: [
        { key: "username", value: state.auth.basic.username, type: "string" },
        { key: "password", value: state.auth.basic.password, type: "string" },
      ],
    };
  } else if (state.auth.type === "bearer" && state.auth.bearer) {
    auth = {
      type: "bearer",
      bearer: [{ key: "token", value: state.auth.bearer.token, type: "string" }],
    };
  } else if (state.auth.type === "apikey" && state.auth.apikey) {
    auth = {
      type: "apikey",
      apikey: [
        { key: "key", value: state.auth.apikey.key, type: "string" },
        { key: "value", value: state.auth.apikey.value, type: "string" },
        { key: "in", value: state.auth.apikey.addTo, type: "string" },
      ],
    };
  }

  const raw = query.length > 0
    ? `${state.url}?${query.map((q) => `${q.key}=${q.value}`).join("&")}`
    : state.url;

  return {
    name,
    request: {
      method: state.method,
      header: headers,
      url: { raw, protocol, host, ...(port ? { port } : {}), path, query },
      ...(body ? { body } : {}),
      ...(auth ? { auth } : {}),
    },
  };
}

export function exportAsPostmanJson(collection: ExportCollection): PostmanCollectionExport {
  const items: PostmanItem[] = collection.requests.map((req) => {
    const state = parseCurl(req.curl);
    return stateToPostmanRequest(req.name, state);
  });

  return {
    info: {
      name: collection.name,
      description: collection.description || "",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: items,
  };
}

export function exportAsShellScript(collection: ExportCollection): string {
  const lines: string[] = [
    "#!/bin/bash",
    `# Collection: ${collection.name}`,
    collection.description ? `# ${collection.description}` : "",
    "set -e",
    "",
  ].filter(Boolean);

  for (const req of collection.requests) {
    lines.push(`# ${req.name}`);
    lines.push(`echo ">>> ${req.name}"`);
    lines.push(req.curl);
    lines.push(`echo ""`);
    lines.push("");
  }

  return lines.join("\n");
}
