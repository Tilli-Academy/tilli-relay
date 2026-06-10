import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeCurl } from "../executor";
import * as child_process from "child_process";
import * as dns from "dns";

vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("dns", () => ({
  promises: {
    lookup: vi.fn(),
  },
}));

const mockExecFile = vi.mocked(child_process.execFile);
const mockDnsLookup = vi.mocked(dns.promises.lookup);

describe("executeCurl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: resolve to a public IP so existing tests pass
    mockDnsLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as any);
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
        "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nHello\n__RELAY_META__\n200|0.050",
        ""
      );
      return {} as any;
    });

    const result = await executeCurl("curl https://example.com");

    expect(mockExecFile).toHaveBeenCalledWith(
      "curl",
      expect.arrayContaining(["https://example.com", "-s", "-S", "-i", "--max-redirs", "5"]),
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
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nX-Request-Id: abc123\r\n\r\n{\"ok\":true}\n__RELAY_META__\n200|0.123",
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
      "\n__RELAY_META__\n200|0.200",
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
        "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nPartial\n__RELAY_META__\n200|29.500",
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
        "HTTP/1.1 200 OK\nContent-Type: text/plain\n\nBody here\n__RELAY_META__\n200|0.010",
        ""
      );
      return {} as any;
    });

    const result = await executeCurl("curl https://example.com");
    expect(result.status).toBe(200);
    expect(result.body).toBe("Body here");
    expect(result.headers["Content-Type"]).toBe("text/plain");
  });

  it("includes -s, -S, -i, --max-redirs, and -w flags automatically", async () => {
    mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
      expect(args).toContain("-s");
      expect(args).toContain("-S");
      expect(args).toContain("-i");
      expect(args).toContain("-w");
      expect(args).toContain("--max-redirs");
      expect(args).toContain("5");
      (callback as Function)(null, "\n__RELAY_META__\n200|0.001", "");
      return {} as any;
    });

    await executeCurl("curl https://example.com");
    expect(mockExecFile).toHaveBeenCalled();
  });

  describe("SSRF protection", () => {
    it("blocks requests to 127.0.0.1", async () => {
      const result = await executeCurl("curl http://127.0.0.1/admin");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });

    it("blocks requests to 10.x.x.x range", async () => {
      const result = await executeCurl("curl http://10.0.0.1/internal");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });

    it("blocks requests to 172.16.x.x range", async () => {
      const result = await executeCurl("curl http://172.16.0.1/api");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });

    it("blocks requests to 192.168.x.x range", async () => {
      const result = await executeCurl("curl http://192.168.1.1/router");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });

    it("blocks requests to cloud metadata IP 169.254.169.254", async () => {
      const result = await executeCurl("curl http://169.254.169.254/latest/meta-data/");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });

    it("blocks requests to 0.0.0.0", async () => {
      const result = await executeCurl("curl http://0.0.0.0/");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });

    it("blocks hostnames resolving to private IPs", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "192.168.1.100", family: 4 },
      ] as any);

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(null, "\n__RELAY_META__\n200|0.001", "");
        return {} as any;
      });

      const result = await executeCurl("curl https://internal.example.com");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it("blocks hostnames resolving to loopback", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "127.0.0.1", family: 4 },
      ] as any);

      const result = await executeCurl("curl https://localhost.example.com");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });

    it("allows hostnames resolving to public IPs", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as any);

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(
          null,
          "HTTP/1.1 200 OK\r\n\r\nOK\n__RELAY_META__\n200|0.050",
          ""
        );
        return {} as any;
      });

      const result = await executeCurl("curl https://example.com");
      expect(result.status).toBe(200);
      expect(mockExecFile).toHaveBeenCalled();
    });

    it("returns error on DNS resolution failure", async () => {
      mockDnsLookup.mockRejectedValue(new Error("ENOTFOUND"));

      const result = await executeCurl("curl https://nonexistent.invalid");
      expect(result.status).toBe(0);
      expect(result.error).toContain("DNS resolution failed");
    });

    it("blocks when any resolved IP is private (multiple results)", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.1", family: 4 },
      ] as any);

      const result = await executeCurl("curl https://dual-homed.example.com");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });

    it("blocks IPv6 loopback ::1", async () => {
      const result = await executeCurl("curl http://[::1]/");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });

    it("blocks IPv6 unique-local (fc/fd) addresses", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "fd00::1", family: 6 },
      ] as any);

      const result = await executeCurl("curl https://ipv6-internal.example.com");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });

    it("blocks requests to 100.64.x.x (shared address space)", async () => {
      const result = await executeCurl("curl http://100.64.0.1/");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });

    it("blocks requests to 198.18.x.x (benchmarking)", async () => {
      const result = await executeCurl("curl http://198.18.0.1/");
      expect(result.status).toBe(0);
      expect(result.error).toContain("private/internal");
    });
  });
});
