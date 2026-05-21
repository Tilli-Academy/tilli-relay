import { describe, it, expect } from "vitest";
import { parseCurl } from "../parser";

describe("parseCurl", () => {
  it("parses a simple GET request", () => {
    const result = parseCurl("curl https://api.example.com");
    expect(result.method).toBe("GET");
    expect(result.url).toBe("https://api.example.com");
    expect(result.headers).toEqual([]);
    expect(result.params).toEqual([]);
    expect(result.body).toBe("");
    expect(result.auth.type).toBe("none");
  });

  it("parses explicit -X GET", () => {
    const result = parseCurl("curl -X GET https://api.example.com");
    expect(result.method).toBe("GET");
  });

  it("parses -X POST", () => {
    const result = parseCurl("curl -X POST https://api.example.com");
    expect(result.method).toBe("POST");
  });

  it("parses --request PUT", () => {
    const result = parseCurl("curl --request PUT https://api.example.com");
    expect(result.method).toBe("PUT");
  });

  it("parses method case-insensitively", () => {
    const result = parseCurl("curl -X post https://api.example.com");
    expect(result.method).toBe("POST");
  });

  it("parses single-quoted URL and extracts query params", () => {
    const result = parseCurl("curl 'https://api.example.com/path?q=1'");
    expect(result.url).toBe("https://api.example.com/path");
    expect(result.params).toEqual([{ key: "q", value: "1", enabled: true }]);
  });

  it("parses double-quoted URL", () => {
    const result = parseCurl('curl "https://api.example.com/path"');
    expect(result.url).toBe("https://api.example.com/path");
  });

  it("parses headers with -H", () => {
    const result = parseCurl("curl -H 'Content-Type: application/json' https://example.com");
    expect(result.headers).toEqual([
      { key: "Content-Type", value: "application/json", enabled: true },
    ]);
  });

  it("parses multiple headers", () => {
    const result = parseCurl(
      "curl -H 'Content-Type: application/json' -H 'Accept: text/html' https://example.com"
    );
    expect(result.headers).toHaveLength(2);
    expect(result.headers[0].key).toBe("Content-Type");
    expect(result.headers[1].key).toBe("Accept");
  });

  it("parses --header long form", () => {
    const result = parseCurl("curl --header 'X-Custom: value' https://example.com");
    expect(result.headers[0]).toEqual({ key: "X-Custom", value: "value", enabled: true });
  });

  it("parses body with -d", () => {
    const result = parseCurl("curl -X POST -d '{\"key\":\"val\"}' https://example.com");
    expect(result.body).toBe('{"key":"val"}');
    expect(result.method).toBe("POST");
  });

  it("parses body with --data", () => {
    const result = parseCurl("curl --data 'name=test' https://example.com");
    expect(result.body).toBe("name=test");
  });

  it("parses body with --data-raw", () => {
    const result = parseCurl("curl --data-raw '{\"a\":1}' https://example.com");
    expect(result.body).toBe('{"a":1}');
  });

  it("implies POST when -d is used without -X", () => {
    const result = parseCurl("curl -d 'data' https://example.com");
    expect(result.method).toBe("POST");
  });

  it("does not override explicit method when -d is used", () => {
    const result = parseCurl("curl -X PUT -d 'data' https://example.com");
    expect(result.method).toBe("PUT");
  });

  it("parses basic auth with -u", () => {
    const result = parseCurl("curl -u 'user:pass' https://example.com");
    expect(result.auth.type).toBe("basic");
    expect(result.auth.basic).toEqual({ username: "user", password: "pass" });
  });

  it("parses basic auth with --user", () => {
    const result = parseCurl("curl --user 'admin:secret123' https://example.com");
    expect(result.auth.type).toBe("basic");
    expect(result.auth.basic).toEqual({ username: "admin", password: "secret123" });
  });

  it("parses basic auth with colon in password", () => {
    const result = parseCurl("curl -u 'user:pass:word' https://example.com");
    expect(result.auth.basic).toEqual({ username: "user", password: "pass:word" });
  });

  it("detects bearer auth from Authorization header", () => {
    const result = parseCurl("curl -H 'Authorization: Bearer mytoken' https://example.com");
    expect(result.auth.type).toBe("bearer");
    expect(result.auth.bearer).toEqual({ token: "mytoken" });
    // Bearer header should NOT appear in regular headers
    expect(result.headers).toEqual([]);
  });

  it("detects bearer auth case-insensitively", () => {
    const result = parseCurl("curl -H 'authorization: bearer mytoken' https://example.com");
    expect(result.auth.type).toBe("bearer");
    expect(result.auth.bearer?.token).toBe("mytoken");
  });

  it("skips no-arg flags like -s -S -L -k", () => {
    const result = parseCurl("curl -s -S -L -k https://example.com");
    expect(result.url).toBe("https://example.com");
    expect(result.method).toBe("GET");
  });

  it("skips flags with arguments like -o, -w, -A", () => {
    const result = parseCurl("curl -o /dev/null -w '%{http_code}' -A 'MyAgent' https://example.com");
    expect(result.url).toBe("https://example.com");
  });

  it("handles header value containing colons", () => {
    const result = parseCurl("curl -H 'X-Time: 12:30:00' https://example.com");
    expect(result.headers[0]).toEqual({ key: "X-Time", value: "12:30:00", enabled: true });
  });

  it("handles empty body", () => {
    const result = parseCurl("curl https://example.com");
    expect(result.body).toBe("");
  });

  it("handles escaped quotes in double-quoted strings", () => {
    const result = parseCurl('curl -d "{\\"key\\":\\"val\\"}" https://example.com');
    expect(result.body).toBe('{"key":"val"}');
  });

  it("extracts multiple query params from URL", () => {
    const result = parseCurl("curl 'https://example.com/api?page=1&limit=10&sort=name'");
    expect(result.url).toBe("https://example.com/api");
    expect(result.params).toEqual([
      { key: "page", value: "1", enabled: true },
      { key: "limit", value: "10", enabled: true },
      { key: "sort", value: "name", enabled: true },
    ]);
  });

  it("decodes URL-encoded query params", () => {
    const result = parseCurl("curl 'https://example.com?q=hello%20world&tag=a%26b'");
    expect(result.params).toEqual([
      { key: "q", value: "hello world", enabled: true },
      { key: "tag", value: "a&b", enabled: true },
    ]);
  });

  it("returns empty params for URL without query string", () => {
    const result = parseCurl("curl https://example.com/path");
    expect(result.params).toEqual([]);
  });

  // Form-data tests
  it("parses -F text field", () => {
    const result = parseCurl("curl -F 'name=test' https://example.com");
    expect(result.bodyType).toBe("form-data");
    expect(result.formData).toEqual([
      { key: "name", value: "test", type: "text", enabled: true },
    ]);
    expect(result.body).toBe("");
  });

  it("parses -F file field", () => {
    const result = parseCurl("curl -F 'file=@/tmp/reqify-uploads/user/abc.txt' https://example.com");
    expect(result.bodyType).toBe("form-data");
    expect(result.formData[0].type).toBe("file");
    expect(result.formData[0].value).toBe("/tmp/reqify-uploads/user/abc.txt");
    expect(result.formData[0].fileName).toBe("abc.txt");
  });

  it("parses -F file field with filename parameter", () => {
    const result = parseCurl("curl -F 'file=@/tmp/path;filename=doc.pdf' https://example.com");
    expect(result.formData[0].value).toBe("/tmp/path");
    expect(result.formData[0].fileName).toBe("doc.pdf");
  });

  it("parses --form long flag", () => {
    const result = parseCurl("curl --form 'key=val' https://example.com");
    expect(result.bodyType).toBe("form-data");
    expect(result.formData[0]).toMatchObject({ key: "key", value: "val", type: "text" });
  });

  it("parses multiple -F flags", () => {
    const result = parseCurl("curl -F 'a=1' -F 'b=2' -F 'c=3' https://example.com");
    expect(result.formData).toHaveLength(3);
    expect(result.formData.map(f => f.key)).toEqual(["a", "b", "c"]);
  });

  it("-F implies POST method", () => {
    const result = parseCurl("curl -F 'name=test' https://example.com");
    expect(result.method).toBe("POST");
  });

  it("returns bodyType none when no body", () => {
    const result = parseCurl("curl https://example.com");
    expect(result.bodyType).toBe("none");
    expect(result.formData).toEqual([]);
  });

  it("returns bodyType text for -d flag", () => {
    const result = parseCurl("curl -d 'hello' https://example.com");
    expect(result.bodyType).toBe("text");
    expect(result.formData).toEqual([]);
  });
});
