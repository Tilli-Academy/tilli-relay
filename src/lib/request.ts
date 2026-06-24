import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";

const DEFAULT_MAX_BYTES = 1024 * 1024; // 1 MB

/**
 * Parses a JSON request body with an explicit size limit.
 * Throws AppError (413 for too large, 400 for invalid JSON) — compatible with handleAppError.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseJsonBody<T = any>(
  req: NextRequest,
  maxBytes: number = DEFAULT_MAX_BYTES
): Promise<T> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new AppError(413, `Request body too large (max ${Math.round(maxBytes / 1024)}KB)`);
  }

  const text = await req.text();
  if (text.length > maxBytes) {
    throw new AppError(413, `Request body too large (max ${Math.round(maxBytes / 1024)}KB)`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError(400, "Invalid JSON body");
  }
}
