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

const FORM_FLAGS = new Set(["-F", "--form"]);
const COOKIE_FLAGS = new Set(["-b", "--cookie"]);

/**
 * Centralized validation of a flag's value for file-reference attacks.
 *
 * curl can read arbitrary server files via several mechanisms:
 *   -d @/file, --data-binary @/file     — send file as POST body
 *   -H @/file                           — send file lines as request headers (curl 7.55+)
 *   -F 'field=@/file'                   — upload file as multipart form
 *   -F 'field=</file'                   — read file content into form field
 *   -b /file                            — read cookies from file (bare path, no prefix)
 *
 * Strategy: block @ and < at the start of ALL flag values by default.
 * Exceptions:
 *   -F allows @path ONLY inside UPLOAD_DIR (legitimate file uploads)
 *   -b allows key=value strings (inline cookies, not file paths)
 */
function validateFlagValue(flag: string, value: string): string | null {
  // --- -F / --form: value is "key=content", validate the content part ---
  if (FORM_FLAGS.has(flag)) {
    const eqIdx = value.indexOf("=");
    if (eqIdx !== -1) {
      const content = value.slice(eqIdx + 1);

      // < reads file content into the field — always block
      if (content.startsWith("<")) {
        return "File content references (<) are not allowed in form fields";
      }

      // @ uploads a file — allow only from UPLOAD_DIR
      if (content.startsWith("@")) {
        const filePath = content.slice(1).split(";")[0]; // strip ;filename=... suffix
        if (!filePath.startsWith(UPLOAD_DIR + "/")) {
          return "File path in -F must be within the upload directory";
        }
        if (filePath.includes("..")) {
          return "Path traversal not allowed in -F file paths";
        }
        // Safe upload path — allow
        return null;
      }
    }
    // Plain text form field — safe
    return null;
  }

  // --- -b / --cookie: bare paths (no =) are file reads ---
  if (COOKIE_FLAGS.has(flag)) {
    if (value.length > 0 && !value.includes("=")) {
      return "Cookie file paths are not allowed; use key=value format";
    }
    // Inline cookie with = — still check for @ and < at start
  }

  // --- Universal: block @ and < at start of value for ALL flags ---
  // curl interprets @file as "read from file" for -d, --data*, -H (7.55+), etc.
  // < has no special meaning outside -F, but we block defensively against future
  // curl versions or unexpected flag behaviour.
  if (value.startsWith("@")) {
    return "File references (@) are not allowed in flag values";
  }
  if (value.startsWith("<")) {
    return "File content references (<) are not allowed in flag values";
  }

  return null;
}

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
        // --flag=value syntax: validate value portion
        const flagValue = token.slice(eqIdx + 1);
        const err = validateFlagValue(flagName, flagValue);
        if (err) {
          return { valid: false, error: err, sanitizedArgs: [] };
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

          const err = validateFlagValue(token, tokens[i]);
          if (err) {
            return { valid: false, error: err, sanitizedArgs: [] };
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
