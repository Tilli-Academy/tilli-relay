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
      expect.arrayContaining([
        "--resolve", "example.com:443:93.184.216.34",
        "https://example.com",
        "-s", "-S", "-i",
      ]),
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

  it("includes -s, -S, -i, --noproxy, and -w flags automatically", async () => {
    mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
      expect(args).toContain("-s");
      expect(args).toContain("-S");
      expect(args).toContain("-i");
      expect(args).toContain("-w");
      expect(args).toContain("--noproxy");
      (callback as Function)(null, "\n__RELAY_META__\n200|0.001", "");
      return {} as any;
    });

    await executeCurl("curl https://example.com");
    expect(mockExecFile).toHaveBeenCalled();
  });

  // ─── DNS pinning (prevents TOCTOU / DNS rebinding) ────────────────────────

  describe("DNS pinning", () => {
    it("adds --resolve flag for hostnames that pass DNS validation", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as any);

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain("--resolve");
        expect(args).toContain("example.com:443:93.184.216.34");
        (callback as Function)(
          null,
          "HTTP/1.1 200 OK\r\n\r\nOK\n__RELAY_META__\n200|0.050",
          ""
        );
        return {} as any;
      });

      const result = await executeCurl("curl https://example.com");
      expect(result.status).toBe(200);
    });

    it("uses correct port for http URLs", async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain("example.com:80:93.184.216.34");
        (callback as Function)(
          null,
          "HTTP/1.1 200 OK\r\n\r\nOK\n__RELAY_META__\n200|0.050",
          ""
        );
        return {} as any;
      });

      await executeCurl("curl http://example.com/path");
      expect(mockExecFile).toHaveBeenCalled();
    });

    it("uses explicit port when specified in URL", async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain("example.com:8080:93.184.216.34");
        (callback as Function)(
          null,
          "HTTP/1.1 200 OK\r\n\r\nOK\n__RELAY_META__\n200|0.050",
          ""
        );
        return {} as any;
      });

      await executeCurl("curl http://example.com:8080/api");
      expect(mockExecFile).toHaveBeenCalled();
    });

    it("does not add --resolve for IP literals", async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        const joined = (args ?? []).join(" ");
        expect(joined).not.toContain("--resolve");
        (callback as Function)(
          null,
          "HTTP/1.1 200 OK\r\n\r\nOK\n__RELAY_META__\n200|0.050",
          ""
        );
        return {} as any;
      });

      // 93.184.216.34 is a public IP — not blocked
      await executeCurl("curl http://93.184.216.34/");
      expect(mockExecFile).toHaveBeenCalled();
    });

    it("prefers IPv4 address for pinning when both families returned", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
        { address: "93.184.216.34", family: 4 },
      ] as any);

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain("example.com:443:93.184.216.34");
        (callback as Function)(
          null,
          "HTTP/1.1 200 OK\r\n\r\nOK\n__RELAY_META__\n200|0.050",
          ""
        );
        return {} as any;
      });

      await executeCurl("curl https://example.com");
      expect(mockExecFile).toHaveBeenCalled();
    });
  });

  // ─── Redirect re-validation (prevents -L SSRF bypass) ────────────────────

  describe("redirect SSRF protection", () => {
    it("follows redirects to safe hosts when -L is present", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as any);

      // First call: 302 redirect
      mockExecFile.mockImplementationOnce((_cmd, _args, _opts, callback) => {
        (callback as Function)(
          null,
          "HTTP/1.1 302 Found\r\nLocation: https://other.example.com/page\r\n\r\n\n__RELAY_META__\n302|0.010",
          ""
        );
        return {} as any;
      });

      // Second call: 200 final response
      mockExecFile.mockImplementationOnce((_cmd, _args, _opts, callback) => {
        (callback as Function)(
          null,
          "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nFinal body\n__RELAY_META__\n200|0.020",
          ""
        );
        return {} as any;
      });

      const result = await executeCurl("curl -L https://example.com");
      expect(result.status).toBe(200);
      expect(result.body).toBe("Final body");
      expect(result.timeMs).toBe(30); // 10 + 20
      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });

    it("blocks redirect to private IP literal", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as any);

      mockExecFile.mockImplementationOnce((_cmd, _args, _opts, callback) => {
        (callback as Function)(
          null,
          "HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/latest/meta-data/\r\n\r\n\n__RELAY_META__\n302|0.010",
          ""
        );
        return {} as any;
      });

      const result = await executeCurl("curl -L https://safe.example.com");
      expect(result.status).toBe(0);
      expect(result.error).toContain("Redirect blocked");
      expect(result.error).toContain("private/internal");
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it("blocks redirect to hostname resolving to private IP (DNS rebinding)", async () => {
      // First resolution (initial URL): public IP
      mockDnsLookup.mockResolvedValueOnce([
        { address: "93.184.216.34", family: 4 },
      ] as any);
      // Second resolution (redirect target): private IP
      mockDnsLookup.mockResolvedValueOnce([
        { address: "10.0.0.1", family: 4 },
      ] as any);

      mockExecFile.mockImplementationOnce((_cmd, _args, _opts, callback) => {
        (callback as Function)(
          null,
          "HTTP/1.1 302 Found\r\nLocation: https://evil-rebind.example.com/steal\r\n\r\n\n__RELAY_META__\n302|0.010",
          ""
        );
        return {} as any;
      });

      const result = await executeCurl("curl -L https://safe.example.com");
      expect(result.status).toBe(0);
      expect(result.error).toContain("Redirect blocked");
      expect(result.error).toContain("private/internal");
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it("limits redirect chain length", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as any);

      // Every call returns another redirect
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(
          null,
          "HTTP/1.1 302 Found\r\nLocation: https://example.com/loop\r\n\r\n\n__RELAY_META__\n302|0.001",
          ""
        );
        return {} as any;
      });

      const result = await executeCurl("curl -L https://example.com/start");
      expect(result.status).toBe(0);
      expect(result.error).toContain("Too many redirects");
      // 5 + 1 initial = 6 total execFile calls before hitting the limit
      expect(mockExecFile).toHaveBeenCalledTimes(6);
    });

    it("does not follow redirects when -L is not specified", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as any);

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(
          null,
          "HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/\r\n\r\n\n__RELAY_META__\n302|0.010",
          ""
        );
        return {} as any;
      });

      const result = await executeCurl("curl https://example.com");
      // Without -L, the 302 is returned directly (no following, no blocking)
      expect(result.status).toBe(302);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it("blocks redirect to non-http/https protocol", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as any);

      mockExecFile.mockImplementationOnce((_cmd, _args, _opts, callback) => {
        (callback as Function)(
          null,
          "HTTP/1.1 302 Found\r\nLocation: file:///etc/passwd\r\n\r\n\n__RELAY_META__\n302|0.010",
          ""
        );
        return {} as any;
      });

      const result = await executeCurl("curl -L https://example.com");
      expect(result.status).toBe(0);
      expect(result.error).toContain("disallowed protocol");
    });

    it("returns redirect response as-is when Location header is missing", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as any);

      mockExecFile.mockImplementationOnce((_cmd, _args, _opts, callback) => {
        (callback as Function)(
          null,
          "HTTP/1.1 301 Moved\r\nX-Info: no-location\r\n\r\n\n__RELAY_META__\n301|0.010",
          ""
        );
        return {} as any;
      });

      const result = await executeCurl("curl -L https://example.com");
      expect(result.status).toBe(301);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it("re-pins DNS for each redirect hop", async () => {
      // Hop 1 → resolves to one IP
      mockDnsLookup.mockResolvedValueOnce([
        { address: "93.184.216.34", family: 4 },
      ] as any);
      // Hop 2 (redirect target) → resolves to a different IP
      mockDnsLookup.mockResolvedValueOnce([
        { address: "104.16.132.229", family: 4 },
      ] as any);

      const execCalls: string[][] = [];

      mockExecFile.mockImplementationOnce((_cmd, args, _opts, callback) => {
        execCalls.push([...(args ?? [])]);
        (callback as Function)(
          null,
          "HTTP/1.1 302 Found\r\nLocation: https://other.example.com/final\r\n\r\n\n__RELAY_META__\n302|0.010",
          ""
        );
        return {} as any;
      });
      mockExecFile.mockImplementationOnce((_cmd, args, _opts, callback) => {
        execCalls.push([...(args ?? [])]);
        (callback as Function)(
          null,
          "HTTP/1.1 200 OK\r\n\r\nDone\n__RELAY_META__\n200|0.020",
          ""
        );
        return {} as any;
      });

      await executeCurl("curl -L https://example.com");

      // First hop pinned to 93.184.216.34
      expect(execCalls[0]).toContain("example.com:443:93.184.216.34");
      // Second hop pinned to 104.16.132.229
      expect(execCalls[1]).toContain("other.example.com:443:104.16.132.229");
    });

    it("changes method to GET and drops body on 303 redirect", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as any);

      const execCalls: string[][] = [];

      mockExecFile.mockImplementationOnce((_cmd, args, _opts, callback) => {
        execCalls.push([...(args ?? [])]);
        (callback as Function)(
          null,
          "HTTP/1.1 303 See Other\r\nLocation: https://example.com/result\r\n\r\n\n__RELAY_META__\n303|0.010",
          ""
        );
        return {} as any;
      });
      mockExecFile.mockImplementationOnce((_cmd, args, _opts, callback) => {
        execCalls.push([...(args ?? [])]);
        (callback as Function)(
          null,
          "HTTP/1.1 200 OK\r\n\r\nResult\n__RELAY_META__\n200|0.020",
          ""
        );
        return {} as any;
      });

      await executeCurl('curl -L -X POST -d "payload" https://example.com/submit');

      // Second hop should have GET and no body
      const secondArgs = execCalls[1];
      const methodIdx = secondArgs.indexOf("-X");
      expect(secondArgs[methodIdx + 1]).toBe("GET");
      expect(secondArgs).not.toContain("-d");
      expect(secondArgs).not.toContain("payload");
    });

    it("preserves method and body on 307 redirect", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as any);

      const execCalls: string[][] = [];

      mockExecFile.mockImplementationOnce((_cmd, args, _opts, callback) => {
        execCalls.push([...(args ?? [])]);
        (callback as Function)(
          null,
          "HTTP/1.1 307 Temporary Redirect\r\nLocation: https://example.com/new\r\n\r\n\n__RELAY_META__\n307|0.010",
          ""
        );
        return {} as any;
      });
      mockExecFile.mockImplementationOnce((_cmd, args, _opts, callback) => {
        execCalls.push([...(args ?? [])]);
        (callback as Function)(
          null,
          "HTTP/1.1 200 OK\r\n\r\nCreated\n__RELAY_META__\n200|0.020",
          ""
        );
        return {} as any;
      });

      await executeCurl('curl -L -X POST -d "payload" https://example.com/api');

      // Second hop should still have POST and body
      const secondArgs = execCalls[1];
      const methodIdx = secondArgs.indexOf("-X");
      expect(secondArgs[methodIdx + 1]).toBe("POST");
      expect(secondArgs).toContain("-d");
      expect(secondArgs).toContain("payload");
    });

    it("accumulates total time across redirect hops", async () => {
      mockDnsLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as any);

      mockExecFile.mockImplementationOnce((_cmd, _args, _opts, callback) => {
        (callback as Function)(
          null,
          "HTTP/1.1 302 Found\r\nLocation: https://example.com/final\r\n\r\n\n__RELAY_META__\n302|0.100",
          ""
        );
        return {} as any;
      });
      mockExecFile.mockImplementationOnce((_cmd, _args, _opts, callback) => {
        (callback as Function)(
          null,
          "HTTP/1.1 200 OK\r\n\r\nDone\n__RELAY_META__\n200|0.200",
          ""
        );
        return {} as any;
      });

      const result = await executeCurl("curl -L https://example.com");
      expect(result.timeMs).toBe(300); // 100 + 200
    });
  });

  // ─── SSRF protection (IP blocklist) ───────────────────────────────────────

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
