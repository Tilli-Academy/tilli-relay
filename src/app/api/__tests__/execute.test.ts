import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../execute/route";
import { NextRequest } from "next/server";
import * as child_process from "child_process";

vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({ userId: "test-user-id" }),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, retryAfterSec: 0 }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("@/lib/schema", () => ({
  environmentVariables: { key: "key", value: "value", userId: "user_id" },
}));

vi.mock("@/lib/upload", () => ({
  cleanupTempFiles: vi.fn().mockResolvedValue(undefined),
}));

const mockExecFile = vi.mocked(child_process.execFile);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for missing curl field", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("curl");
  });

  it("returns 400 for non-string curl field", async () => {
    const res = await POST(makeRequest({ curl: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for oversized curl command", async () => {
    const res = await POST(makeRequest({ curl: "curl " + "x".repeat(50_001) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("maximum length");
  });

  it("returns 422 for invalid curl (sanitizer rejects)", async () => {
    const res = await POST(makeRequest({ curl: "curl ftp://evil.com" }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toContain("http:// or https://");
  });

  it("returns 422 for shell injection attempt", async () => {
    const res = await POST(makeRequest({ curl: "curl https://example.com; rm -rf /" }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("returns 200 with execution result for valid curl", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      (callback as Function)(
        null,
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"ok\":true}\n__RELAY_META__\n200|0.042",
        ""
      );
      return {} as any;
    });

    const res = await POST(makeRequest({ curl: "curl https://example.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe(200);
    expect(json.body).toBe('{"ok":true}');
    expect(json.timeMs).toBe(42);
    expect(json.headers["Content-Type"]).toBe("application/json");
  });

  it("returns 422 when curl execution fails completely", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      (callback as Function)(new Error("timeout"), "", "curl: (28) Connection timed out");
      return {} as any;
    });

    const res = await POST(makeRequest({ curl: "curl https://example.com" }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toContain("timed out");
  });

  it("passes the user's curl flags to execFile", async () => {
    mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
      // Verify user flags are present
      expect(args).toContain("-X");
      expect(args).toContain("POST");
      expect(args).toContain("-H");
      expect(args).toContain("Content-Type: application/json");
      (callback as Function)(null, "\n__RELAY_META__\n200|0.001", "");
      return {} as any;
    });

    await POST(makeRequest({
      curl: "curl -X POST -H 'Content-Type: application/json' https://example.com",
    }));

    expect(mockExecFile).toHaveBeenCalled();
  });
});
