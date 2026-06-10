import { describe, it, expect } from "vitest";
import { buildCurl } from "../builder";
import { RequestState } from "@/lib/types";

function makeState(overrides: Partial<RequestState> = {}): RequestState {
  return {
    method: "GET",
    url: "https://api.example.com",
    headers: [],
    params: [],
    body: "",
    bodyType: "none",
    formData: [],
    auth: { type: "none" },
    ...overrides,
  };
}

describe("buildCurl", () => {
  it("builds a simple GET request", () => {
    const result = buildCurl(makeState());
    expect(result).toBe("curl 'https://api.example.com'");
  });

  it("omits -X for GET", () => {
    const result = buildCurl(makeState({ method: "GET" }));
    expect(result).not.toContain("-X");
  });

  it("includes -X for POST", () => {
    const result = buildCurl(makeState({ method: "POST" }));
    expect(result).toContain("-X POST");
  });

  it("includes -X for PUT, DELETE, PATCH", () => {
    for (const method of ["PUT", "DELETE", "PATCH"] as const) {
      const result = buildCurl(makeState({ method }));
      expect(result).toContain(`-X ${method}`);
    }
  });

  it("includes enabled headers", () => {
    const result = buildCurl(makeState({
      headers: [
        { key: "Content-Type", value: "application/json", enabled: true },
        { key: "Accept", value: "text/html", enabled: true },
      ],
    }));
    expect(result).toContain("-H 'Content-Type: application/json'");
    expect(result).toContain("-H 'Accept: text/html'");
  });

  it("skips disabled headers", () => {
    const result = buildCurl(makeState({
      headers: [
        { key: "X-Skip", value: "yes", enabled: false },
        { key: "X-Keep", value: "yes", enabled: true },
      ],
    }));
    expect(result).not.toContain("X-Skip");
    expect(result).toContain("X-Keep");
  });

  it("skips headers with empty keys", () => {
    const result = buildCurl(makeState({
      headers: [{ key: "", value: "something", enabled: true }],
    }));
    expect(result).not.toContain("-H");
  });

  it("includes body with -d for POST", () => {
    const result = buildCurl(makeState({
      method: "POST",
      body: '{"name":"test"}',
    }));
    expect(result).toContain("-d '{\"name\":\"test\"}'");
  });

  it("omits body for GET even if body is set", () => {
    const result = buildCurl(makeState({
      method: "GET",
      body: '{"name":"test"}',
    }));
    expect(result).not.toContain("-d");
  });

  it("handles basic auth", () => {
    const result = buildCurl(makeState({
      auth: { type: "basic", basic: { username: "user", password: "pass" } },
    }));
    expect(result).toContain("-u 'user:pass'");
  });

  it("handles bearer auth", () => {
    const result = buildCurl(makeState({
      auth: { type: "bearer", bearer: { token: "abc123" } },
    }));
    expect(result).toContain("-H 'Authorization: Bearer abc123'");
  });

  it("handles API key in header", () => {
    const result = buildCurl(makeState({
      auth: { type: "apikey", apikey: { key: "X-Api-Key", value: "secret", addTo: "header" } },
    }));
    expect(result).toContain("-H 'X-Api-Key: secret'");
  });

  it("handles API key in query", () => {
    const result = buildCurl(makeState({
      url: "https://api.example.com/data",
      auth: { type: "apikey", apikey: { key: "api_key", value: "secret", addTo: "query" } },
    }));
    expect(result).toContain("https://api.example.com/data?api_key=secret");
  });

  it("appends API key query to URL that already has query params", () => {
    const result = buildCurl(makeState({
      url: "https://api.example.com/data?page=1",
      auth: { type: "apikey", apikey: { key: "api_key", value: "secret", addTo: "query" } },
    }));
    expect(result).toContain("https://api.example.com/data?page=1&api_key=secret");
  });

  it("escapes single quotes in header values", () => {
    const result = buildCurl(makeState({
      headers: [{ key: "X-Custom", value: "it's a test", enabled: true }],
    }));
    // Should use the '\'' escape pattern
    expect(result).toContain("it'\\''s a test");
  });

  it("escapes single quotes in body", () => {
    const result = buildCurl(makeState({
      method: "POST",
      body: "{'key': 'value'}",
    }));
    expect(result).toContain("'\\''");
  });

  it("handles empty URL gracefully", () => {
    const result = buildCurl(makeState({ url: "" }));
    expect(result).toBe("curl");
  });

  it("handles auth type none — no auth flags", () => {
    const result = buildCurl(makeState({ auth: { type: "none" } }));
    expect(result).not.toContain("-u");
    expect(result).not.toContain("Authorization");
  });

  it("appends enabled params as query string", () => {
    const result = buildCurl(makeState({
      url: "https://api.example.com/data",
      params: [
        { key: "page", value: "1", enabled: true },
        { key: "limit", value: "10", enabled: true },
      ],
    }));
    expect(result).toContain("https://api.example.com/data?page=1&limit=10");
  });

  it("skips disabled params", () => {
    const result = buildCurl(makeState({
      url: "https://api.example.com/data",
      params: [
        { key: "page", value: "1", enabled: true },
        { key: "debug", value: "true", enabled: false },
      ],
    }));
    expect(result).toContain("page=1");
    expect(result).not.toContain("debug");
  });

  it("skips params with empty keys", () => {
    const result = buildCurl(makeState({
      url: "https://api.example.com",
      params: [{ key: "", value: "something", enabled: true }],
    }));
    expect(result).not.toContain("?");
  });

  it("URL encodes special characters in params", () => {
    const result = buildCurl(makeState({
      url: "https://api.example.com",
      params: [{ key: "q", value: "hello world", enabled: true }],
    }));
    expect(result).toContain("q=hello%20world");
  });

  it("appends API key after params in query", () => {
    const result = buildCurl(makeState({
      url: "https://api.example.com",
      params: [{ key: "page", value: "1", enabled: true }],
      auth: { type: "apikey", apikey: { key: "api_key", value: "secret", addTo: "query" } },
    }));
    expect(result).toContain("page=1&api_key=secret");
  });

  it("URL encodes API key query params", () => {
    const result = buildCurl(makeState({
      url: "https://api.example.com",
      auth: { type: "apikey", apikey: { key: "my key", value: "my value", addTo: "query" } },
    }));
    expect(result).toContain("my%20key=my%20value");
  });

  // Form-data tests
  it("builds -F flags for text form-data fields", () => {
    const result = buildCurl(makeState({
      method: "POST",
      bodyType: "form-data",
      formData: [
        { key: "name", value: "test", type: "text", enabled: true },
        { key: "email", value: "a@b.com", type: "text", enabled: true },
      ],
    }));
    expect(result).toContain("-F 'name=test'");
    expect(result).toContain("-F 'email=a@b.com'");
  });

  it("builds -F flags for file form-data fields", () => {
    const result = buildCurl(makeState({
      method: "POST",
      bodyType: "form-data",
      formData: [
        { key: "file", value: "/tmp/relay-uploads/user/abc.txt", type: "file", enabled: true, fileName: "doc.txt" },
      ],
    }));
    expect(result).toContain("-F 'file=@/tmp/relay-uploads/user/abc.txt;filename=doc.txt'");
  });

  it("skips disabled form-data fields", () => {
    const result = buildCurl(makeState({
      method: "POST",
      bodyType: "form-data",
      formData: [
        { key: "name", value: "test", type: "text", enabled: false },
      ],
    }));
    expect(result).not.toContain("-F");
  });

  it("skips form-data fields with empty keys", () => {
    const result = buildCurl(makeState({
      method: "POST",
      bodyType: "form-data",
      formData: [
        { key: "", value: "test", type: "text", enabled: true },
      ],
    }));
    expect(result).not.toContain("-F");
  });

  it("does not add Content-Type header for form-data", () => {
    const result = buildCurl(makeState({
      method: "POST",
      bodyType: "form-data",
      formData: [
        { key: "name", value: "test", type: "text", enabled: true },
      ],
    }));
    expect(result).not.toContain("Content-Type");
  });

  it("ignores form-data for GET method", () => {
    const result = buildCurl(makeState({
      method: "GET",
      bodyType: "form-data",
      formData: [
        { key: "name", value: "test", type: "text", enabled: true },
      ],
    }));
    expect(result).not.toContain("-F");
  });
});
