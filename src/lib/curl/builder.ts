import { RequestState } from "@/lib/types";

/**
 * Escapes a value for use inside single quotes in a shell command.
 * The strategy is: replace ' with '\'' (end quote, escaped quote, start quote).
 */
function shellEscape(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

/**
 * Converts UI request state into a valid curl command string.
 */
export function buildCurl(state: RequestState): string {
  const parts: string[] = ["curl"];

  // Method
  if (state.method !== "GET") {
    parts.push("-X", state.method);
  }

  // Headers
  for (const header of state.headers) {
    if (header.enabled && header.key) {
      parts.push("-H", shellEscape(`${header.key}: ${header.value}`));
    }
  }

  // Auth
  switch (state.auth.type) {
    case "basic":
      if (state.auth.basic) {
        parts.push("-u", shellEscape(`${state.auth.basic.username}:${state.auth.basic.password}`));
      }
      break;
    case "bearer":
      if (state.auth.bearer) {
        parts.push("-H", shellEscape(`Authorization: Bearer ${state.auth.bearer.token}`));
      }
      break;
    case "apikey":
      if (state.auth.apikey) {
        if (state.auth.apikey.addTo === "header") {
          parts.push("-H", shellEscape(`${state.auth.apikey.key}: ${state.auth.apikey.value}`));
        }
        // query params are appended to URL below
      }
      break;
  }

  // Body
  if (state.method !== "GET") {
    if (state.bodyType === "form-data" && state.formData?.length) {
      for (const field of state.formData) {
        if (!field.enabled || !field.key) continue;
        if (field.type === "file" && field.value) {
          const filePart = field.fileName
            ? `${field.key}=@${field.value};filename=${field.fileName}`
            : `${field.key}=@${field.value}`;
          parts.push("-F", shellEscape(filePart));
        } else if (field.type === "text") {
          parts.push("-F", shellEscape(`${field.key}=${field.value}`));
        }
      }
    } else if (state.body) {
      // Auto-add Content-Type: application/json if body looks like JSON and no Content-Type is set
      const hasContentType = state.headers.some(
        (h) => h.enabled && h.key.toLowerCase() === "content-type"
      );
      if (!hasContentType) {
        const trimmed = state.body.trimStart();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          parts.push("-H", shellEscape("Content-Type: application/json"));
        }
      }
      parts.push("-d", shellEscape(state.body));
    }
  }

  // URL (with query params and apikey query param if needed)
  let url = state.url || "";

  // Append enabled query params
  const enabledParams = (state.params || []).filter((p) => p.enabled && p.key);
  if (enabledParams.length > 0) {
    const queryStr = enabledParams
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join("&");
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}${queryStr}`;
  }

  if (state.auth.type === "apikey" && state.auth.apikey?.addTo === "query" && state.auth.apikey.key) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}${encodeURIComponent(state.auth.apikey.key)}=${encodeURIComponent(state.auth.apikey.value)}`;
  }

  if (url) {
    parts.push(shellEscape(url));
  }

  return parts.join(" ");
}
