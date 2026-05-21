import { RequestState, HttpMethod, Header, AuthState, FormDataField, BodyType } from "@/lib/types";

/**
 * Parses a curl command string into structured RequestState.
 */
export function parseCurl(curl: string): RequestState {
  const tokens = tokenize(curl);

  let method: HttpMethod = "GET";
  const headers: Header[] = [];
  let body = "";
  let url = "";
  const auth: AuthState = { type: "none" };
  const formDataFields: FormDataField[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === "curl") {
      i++;
      continue;
    }

    if (token === "-X" || token === "--request") {
      i++;
      method = (tokens[i]?.toUpperCase() as HttpMethod) || "GET";
      i++;
      continue;
    }

    if (token === "-H" || token === "--header") {
      i++;
      const headerStr = tokens[i] || "";
      const colonIdx = headerStr.indexOf(":");
      if (colonIdx !== -1) {
        const key = headerStr.slice(0, colonIdx).trim();
        const value = headerStr.slice(colonIdx + 1).trim();

        // Detect bearer auth from header
        if (key.toLowerCase() === "authorization" && value.toLowerCase().startsWith("bearer ")) {
          auth.type = "bearer";
          auth.bearer = { token: value.slice(7) };
        } else {
          headers.push({ key, value, enabled: true });
        }
      }
      i++;
      continue;
    }

    if (token === "-d" || token === "--data" || token === "--data-raw" || token === "--data-binary") {
      i++;
      body = tokens[i] || "";
      if (method === "GET") method = "POST";
      i++;
      continue;
    }

    if (token === "-F" || token === "--form") {
      i++;
      const formStr = tokens[i] || "";
      if (method === "GET") method = "POST";
      const eqIdx = formStr.indexOf("=");
      if (eqIdx !== -1) {
        const key = formStr.slice(0, eqIdx);
        const rawValue = formStr.slice(eqIdx + 1);
        if (rawValue.startsWith("@")) {
          const semiIdx = rawValue.indexOf(";");
          const filePath = semiIdx !== -1 ? rawValue.slice(1, semiIdx) : rawValue.slice(1);
          const fileNameMatch = rawValue.match(/;filename=(.+)/);
          formDataFields.push({
            key,
            value: filePath,
            type: "file",
            enabled: true,
            fileName: fileNameMatch?.[1] || filePath.split("/").pop() || "",
          });
        } else {
          formDataFields.push({ key, value: rawValue, type: "text", enabled: true });
        }
      }
      i++;
      continue;
    }

    if (token === "-u" || token === "--user") {
      i++;
      const userStr = tokens[i] || "";
      const colonIdx = userStr.indexOf(":");
      if (colonIdx !== -1) {
        auth.type = "basic";
        auth.basic = {
          username: userStr.slice(0, colonIdx),
          password: userStr.slice(colonIdx + 1),
        };
      }
      i++;
      continue;
    }

    // Skip known flags that take no argument
    if (["-s", "-S", "-L", "-k", "-v", "--verbose", "--silent", "--location", "--insecure"].includes(token)) {
      i++;
      continue;
    }

    // Skip known flags that take an argument
    if (["-o", "--output", "-w", "--write-out", "-A", "--user-agent", "-b", "--cookie", "--connect-timeout", "--max-time", "-D"].includes(token)) {
      i += 2;
      continue;
    }

    // Anything else that doesn't start with - is the URL
    if (!token.startsWith("-")) {
      url = token;
    }

    i++;
  }

  // Extract query params from URL
  const params: Header[] = [];
  const qIdx = url.indexOf("?");
  if (qIdx !== -1) {
    const queryStr = url.slice(qIdx + 1);
    url = url.slice(0, qIdx);
    for (const pair of queryStr.split("&")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx !== -1) {
        params.push({
          key: decodeURIComponent(pair.slice(0, eqIdx)),
          value: decodeURIComponent(pair.slice(eqIdx + 1)),
          enabled: true,
        });
      } else if (pair) {
        params.push({ key: decodeURIComponent(pair), value: "", enabled: true });
      }
    }
  }

  const hasFormData = formDataFields.length > 0;
  const bodyType: BodyType = hasFormData ? "form-data" : body ? "text" : "none";

  return {
    method,
    url,
    headers,
    params,
    body: hasFormData ? "" : body,
    bodyType,
    formData: hasFormData ? formDataFields : [],
    auth,
  };
}

/**
 * Tokenizes a curl command, respecting single and double quotes.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (ch === "\\" && i + 1 < input.length && (inDouble || (!inSingle && !inDouble))) {
      current += input[++i];
      continue;
    }

    if ((ch === " " || ch === "\t" || ch === "\n") && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}
