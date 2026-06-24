/**
 * File upload API tests: upload, validation, sanitization.
 */

import { test, expect } from "../../fixtures/auth.fixture";

test.describe("File Upload", () => {
  test("uploads a small text file successfully", async ({ api }) => {
    const content = "Hello, this is a test file for upload.";
    const buffer = Buffer.from(content, "utf-8");
    const res = await api.uploadFile(buffer, "test-file.txt");

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.fileId).toBeTruthy();
    expect(body.filePath).toBeTruthy();
    expect(body.fileName).toContain("test-file");
    expect(body.size).toBeGreaterThan(0);
  });

  test("rejects file exceeding 10MB limit", async ({ api }) => {
    // Create 11MB buffer
    const size = 11 * 1024 * 1024;
    const buffer = Buffer.alloc(size, "x");
    const res = await api.uploadFile(buffer, "large-file.bin");

    // Should be rejected
    expect([400, 413]).toContain(res.status());
  });

  test("rejects request with no file attached", async ({ api }) => {
    // Send empty multipart
    const res = await api.rawPost("/api/upload", {});
    expect(res.status()).toBe(400);
  });

  test("sanitizes malicious filename with path traversal", async ({ api }) => {
    const content = "malicious content";
    const buffer = Buffer.from(content, "utf-8");
    const res = await api.uploadFile(buffer, "../../../etc/passwd");

    if (res.status() === 200) {
      const body = await res.json();
      // The on-disk path must not contain path traversal sequences (../)
      // Having ".." as part of a flat filename is safe — only "../" or "/.." matters
      expect(body.filePath).not.toContain("../");
      expect(body.filePath).not.toContain("/..");
    } else {
      // Alternatively, the server may reject it outright
      expect([400, 422]).toContain(res.status());
    }
  });

  test("uploaded file path is scoped to user directory", async ({ api }) => {
    const buffer = Buffer.from("test content", "utf-8");
    const res = await api.uploadFile(buffer, "scoped-file.txt");

    expect(res.status()).toBe(200);
    const body = await res.json();
    // File path should be within the relay-uploads directory and scoped to a user UUID
    expect(body.filePath).toContain("relay-uploads");
    // Must contain a UUID-like segment (user directory)
    expect(body.filePath).toMatch(/[a-f0-9-]{36}/);
  });
});
