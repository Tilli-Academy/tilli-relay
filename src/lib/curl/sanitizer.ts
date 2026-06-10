import { SanitizeResult } from "@/lib/types";

/**
 * Flags allowed in user-supplied curl commands.
 * SECURITY: Do NOT add flags that write to the filesystem (-o, --output, -D, -O).
 */
const ALLOWED_FLAGS = new Set([
  "-X", "--request",
  "-H", "--header",
  "-d", "--data", "--data-raw", "--data-binary",
  "-F", "--form",
  "-u", "--user",
  "-A", "--user-agent",
  "-b", "--cookie",
  "-L", "--location",
  "-k", "--insecure",
  "-s", "--silent",
  "-S", "--show-error",
  "-i", "--include",
  "--connect-timeout",
  "--max-time",
]);

/**
 * Flags from the allowed set that consume the next token as a value.
 */
const FLAGS_WITH_VALUE = new Set([
  "-X", "--request",
  "-H", "--header",
  "-d", "--data", "--data-raw", "--data-binary",
  "-F", "--form",
  "-u", "--user",
  "-A", "--user-agent",
  "-b", "--cookie",
  "--connect-timeout",
  "--max-time",
]);

const UPLOAD_DIR = process.env.RELAY_UPLOAD_DIR || "/tmp/relay-uploads";

/** Data flags whose values must not start with @ (prevents arbitrary file read) */
const DATA_FLAGS = new Set(["-d", "--data", "--data-raw", "--data-binary"]);

/** Cookie flags whose values must use key=value format (bare path = file read) */
const COOKIE_FLAGS = new Set(["-b", "--cookie"]);

/**
 * Validates and sanitizes a curl command string.
 * Returns sanitized args array suitable for child_process.execFile.
 *
 * Security note: We do NOT check for shell metacharacters (;|&`$()><) in the raw
 * string because execution uses child_process.execFile which never invokes a shell.
 * These characters are harmless as literal argv values. The flag allowlist below is
 * the actual security gate that prevents dangerous operations.
 */
export function sanitize(curl: string): SanitizeResult {
  const tokens = tokenize(curl);
  return sanitizeTokens(tokens);
}

/**
 * Validates and sanitizes pre-tokenized curl args.
 * Use this when you need to substitute variables between tokenization and validation.
 */
export function sanitizeTokens(tokens: string[]): SanitizeResult {
  if (tokens.length === 0 || tokens[0] !== "curl") {
    return { valid: false, error: "Command must start with 'curl'", sanitizedArgs: [] };
  }

  const args: string[] = [];
  let hasUrl = false;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.startsWith("-")) {
      // Check for --flag=value syntax
      const eqIdx = token.indexOf("=");
      const flagName = eqIdx !== -1 ? token.slice(0, eqIdx) : token;

      if (!ALLOWED_FLAGS.has(flagName)) {
        return { valid: false, error: `Flag '${flagName}' is not allowed`, sanitizedArgs: [] };
      }

      if (eqIdx !== -1) {
        // --flag=value syntax: validate value portion before accepting
        const flagValue = token.slice(eqIdx + 1);
        if (DATA_FLAGS.has(flagName) && flagValue.startsWith("@")) {
          return { valid: false, error: "File references (@) are not allowed in data flags", sanitizedArgs: [] };
        }
        if (COOKIE_FLAGS.has(flagName) && flagValue.length > 0 && !flagValue.includes("=")) {
          return { valid: false, error: "Cookie file paths are not allowed; use key=value format", sanitizedArgs: [] };
        }
        args.push(token);
      } else {
        args.push(token);

        // Flags that consume the next token as a value
        if (FLAGS_WITH_VALUE.has(token)) {
          i++;
          if (i >= tokens.length) {
            return { valid: false, error: `Flag '${token}' requires a value`, sanitizedArgs: [] };
          }

          // Validate file paths in -F values
          if (token === "-F" || token === "--form") {
            const formValue = tokens[i];
            const formEqIdx = formValue.indexOf("=");
            if (formEqIdx !== -1) {
              const rawValue = formValue.slice(formEqIdx + 1);
              if (rawValue.startsWith("@")) {
                const filePath = rawValue.slice(1).split(";")[0];
                if (!filePath.startsWith(UPLOAD_DIR + "/")) {
                  return { valid: false, error: "File path in -F must be within the upload directory", sanitizedArgs: [] };
                }
                if (filePath.includes("..")) {
                  return { valid: false, error: "Path traversal not allowed in -F file paths", sanitizedArgs: [] };
                }
              }
            }
          }

          // Block @file references in data flags (prevents arbitrary file read)
          if (DATA_FLAGS.has(token) && tokens[i].startsWith("@")) {
            return { valid: false, error: "File references (@) are not allowed in data flags", sanitizedArgs: [] };
          }

          // Block cookie file paths (values without = are treated as file paths by curl)
          if (COOKIE_FLAGS.has(token) && tokens[i].length > 0 && !tokens[i].includes("=")) {
            return { valid: false, error: "Cookie file paths are not allowed; use key=value format", sanitizedArgs: [] };
          }

          args.push(tokens[i]);
        }
      }
    } else {
      // Must be a URL
      if (!token.startsWith("http://") && !token.startsWith("https://")) {
        return { valid: false, error: "URL must use http:// or https:// protocol", sanitizedArgs: [] };
      }
      hasUrl = true;
      args.push(token);
    }
  }

  if (!hasUrl) {
    return { valid: false, error: "No URL found in command", sanitizedArgs: [] };
  }

  return { valid: true, sanitizedArgs: args };
}

/**
 * Tokenizes a curl command, respecting single and double quotes.
 */
export function tokenize(input: string): string[] {
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

    if ((ch === " " || ch === "\t" || ch === "\n" || ch === "\r") && !inSingle && !inDouble) {
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
