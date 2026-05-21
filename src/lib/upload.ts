import { unlink } from "fs/promises";
import { existsSync } from "fs";

export const UPLOAD_DIR = process.env.REQIFY_UPLOAD_DIR || "/tmp/reqify-uploads";
export const MAX_FILE_SIZE = parseInt(process.env.REQIFY_MAX_UPLOAD_SIZE || "10485760", 10); // 10MB

/**
 * Cleans up temporary files referenced in a curl command's -F flags.
 * Only deletes files within the UPLOAD_DIR to prevent accidental deletion.
 */
export async function cleanupTempFiles(curlCommand: string): Promise<void> {
  const filePathRegex = /@(\/tmp\/reqify-uploads\/[^\s;'"]+)/g;
  let match;
  while ((match = filePathRegex.exec(curlCommand)) !== null) {
    const filePath = match[1];
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch {
      // Silently ignore cleanup failures
    }
  }
}
