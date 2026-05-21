import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeCurl } from "../executor";
import * as child_process from "child_process";

vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(child_process.execFile);

describe("executeCurl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid curl command", async () => {
    const result = await executeCurl("wget https://evil.com");
    expect(result.status).toBe(0);
    expect(result.error).toBeTruthy();
  });

  it("returns error for shell injection attempt", async () => {
    const result = await executeCurl("curl https://example.com; rm -rf /");
    expect(result.status).toBe(0);
    expect(result.error).toBeTruthy();
  });

  it("calls execFile with correct args for valid command", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      (callback as Function)(
        null,
        "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nHello\n__REQIFY_META__\n200|0.050",
        ""
      );
      return {} as any;
    });

    const result = await executeCurl("curl https://example.com");

    expect(mockExecFile).toHaveBeenCalledWith(
      "curl",
      expect.arrayContaining(["https://example.com", "-s", "-S", "-i"]),
      expect.objectContaining({ timeout: 30000 }),
      expect.any(Function)
    );
    expect(result.status).toBe(200);
    expect(result.body).toBe("Hello");
    expect(result.timeMs).toBe(50);
  });

  it("parses response headers correctly", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      (callback as Function)(
        null,
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nX-Request-Id: abc123\r\n\r\n{\"ok\":true}\n__REQIFY_META__\n200|0.123",
        ""
      );
      return {} as any;
    });

    const result = await executeCurl("curl https://example.com");
    expect(result.headers["Content-Type"]).toBe("application/json");
    expect(result.headers["X-Request-Id"]).toBe("abc123");
    expect(result.body).toBe('{"ok":true}');
    expect(result.timeMs).toBe(123);
  });

  it("handles redirect responses (multiple header blocks)", async () => {
    const stdout = [
      "HTTP/1.1 301 Moved\r\nLocation: https://example.com/new\r\n\r\n",
      "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nFinal body",
      "\n__REQIFY_META__\n200|0.200",
    ].join("");

    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      (callback as Function)(null, stdout, "");
      return {} as any;
    });

    const result = await executeCurl("curl -L https://example.com");
    expect(result.status).toBe(200);
    expect(result.headers["Content-Type"]).toBe("text/html");
    expect(result.body).toBe("Final body");
  });

  it("handles curl execution error with no stdout", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      const error = new Error("Connection refused");
      (callback as Function)(error, "", "curl: (7) Failed to connect");
      return {} as any;
    });

    const result = await executeCurl("curl https://example.com");
    expect(result.status).toBe(0);
    expect(result.error).toContain("Failed to connect");
  });

  it("handles error with partial stdout", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      const error = new Error("Timeout");
      (callback as Function)(
        error,
        "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nPartial\n__REQIFY_META__\n200|29.500",
        ""
      );
      return {} as any;
    });

    const result = await executeCurl("curl https://example.com");
    // Should still parse the response since stdout exists
    expect(result.status).toBe(200);
    expect(result.body).toBe("Partial");
  });

  it("handles response with \\n\\n line endings instead of \\r\\n\\r\\n", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      (callback as Function)(
        null,
        "HTTP/1.1 200 OK\nContent-Type: text/plain\n\nBody here\n__REQIFY_META__\n200|0.010",
        ""
      );
      return {} as any;
    });

    const result = await executeCurl("curl https://example.com");
    expect(result.status).toBe(200);
    expect(result.body).toBe("Body here");
    expect(result.headers["Content-Type"]).toBe("text/plain");
  });

  it("includes -s, -S, -i, and -w flags automatically", async () => {
    mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
      expect(args).toContain("-s");
      expect(args).toContain("-S");
      expect(args).toContain("-i");
      expect(args).toContain("-w");
      (callback as Function)(null, "\n__REQIFY_META__\n200|0.001", "");
      return {} as any;
    });

    await executeCurl("curl https://example.com");
    expect(mockExecFile).toHaveBeenCalled();
  });
});
