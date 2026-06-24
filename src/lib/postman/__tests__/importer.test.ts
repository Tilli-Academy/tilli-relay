import { describe, it, expect } from "vitest";
import { parsePostmanCollection, validatePostmanJson } from "../importer";

describe("validatePostmanJson", () => {
  it("returns null for valid collection", () => {
    expect(validatePostmanJson({ info: { name: "Test" }, item: [] })).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(validatePostmanJson(null)).toBeTruthy();
    expect(validatePostmanJson("string")).toBeTruthy();
    expect(validatePostmanJson(123)).toBeTruthy();
  });

  it("rejects objects without info or item", () => {
    expect(validatePostmanJson({ foo: "bar" })).toContain("missing");
  });

  it("rejects non-array item", () => {
    expect(validatePostmanJson({ info: {}, item: "not-array" })).toContain("array");
  });

  it("accepts collection with only info", () => {
    expect(validatePostmanJson({ info: { name: "Test" } })).toBeNull();
  });

  it("accepts collection with only item", () => {
    expect(validatePostmanJson({ item: [] })).toBeNull();
  });
});

describe("parsePostmanCollection", () => {
  it("parses collection name and description", () => {
    const result = parsePostmanCollection({
      info: { name: "My API", description: "API tests" },
      item: [],
    });
    expect(result.name).toBe("My API");
    expect(result.description).toBe("API tests");
    expect(result.requests).toEqual([]);
  });

  it("uses default name if info is missing", () => {
    const result = parsePostmanCollection({});
    expect(result.name).toBe("Imported Collection");
  });

  it("parses a simple GET request", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Get Users",
          request: {
            method: "GET",
            url: "https://api.example.com/users",
          },
        },
      ],
    });
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].name).toBe("Get Users");
    expect(result.requests[0].curl).toContain("https://api.example.com/users");
    expect(result.requests[0].curl).not.toContain("-X");
  });

  it("parses POST with body and headers", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Create User",
          request: {
            method: "POST",
            url: "https://api.example.com/users",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: { mode: "raw", raw: '{"name":"test"}' },
          },
        },
      ],
    });
    const curl = result.requests[0].curl;
    expect(curl).toContain("-X POST");
    expect(curl).toContain("Content-Type: application/json");
    expect(curl).toContain('{"name":"test"}');
  });

  it("parses URL object format with raw field", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Get Item",
          request: {
            method: "GET",
            url: { raw: "https://api.example.com/items/1" },
          },
        },
      ],
    });
    expect(result.requests[0].curl).toContain("https://api.example.com/items/1");
  });

  // --- Structured URL tests ---

  it("builds URL from host and path arrays", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Structured URL",
          request: {
            method: "GET",
            url: {
              protocol: "https",
              host: ["api", "example", "com"],
              path: ["v1", "users"],
            },
          },
        },
      ],
    });
    expect(result.requests[0].curl).toContain("https://api.example.com/v1/users");
  });

  it("builds URL from host string and path string", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "String URL parts",
          request: {
            method: "GET",
            url: {
              protocol: "http",
              host: "localhost:3000",
              path: "api/health",
            },
          },
        },
      ],
    });
    expect(result.requests[0].curl).toContain("http://localhost:3000/api/health");
  });

  it("includes enabled query params from structured URL", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Query params",
          request: {
            method: "GET",
            url: {
              raw: "https://api.example.com/search?q=test&page=1",
              protocol: "https",
              host: ["api", "example", "com"],
              path: ["search"],
              query: [
                { key: "q", value: "test" },
                { key: "page", value: "1" },
                { key: "debug", value: "true", disabled: true },
              ],
            },
          },
        },
      ],
    });
    // Should use raw URL when available
    expect(result.requests[0].curl).toContain("https://api.example.com/search?q=test&page=1");
  });

  it("builds URL from parts when raw is missing", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "No raw URL",
          request: {
            method: "GET",
            url: {
              protocol: "https",
              host: ["api", "example", "com"],
              path: ["data"],
              query: [
                { key: "limit", value: "10" },
              ],
            },
          },
        },
      ],
    });
    expect(result.requests[0].curl).toContain("https://api.example.com/data?limit=10");
  });

  // --- Body mode tests ---

  it("parses urlencoded body mode", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Form Login",
          request: {
            method: "POST",
            url: "https://example.com/login",
            body: {
              mode: "urlencoded",
              urlencoded: [
                { key: "username", value: "admin" },
                { key: "password", value: "secret" },
                { key: "remember", value: "true", disabled: true },
              ],
            },
          },
        },
      ],
    });
    const curl = result.requests[0].curl;
    expect(curl).toContain("username=admin");
    expect(curl).toContain("password=secret");
    expect(curl).not.toContain("remember");
    expect(curl).toContain("application/x-www-form-urlencoded");
  });

  it("parses formdata body mode (text fields only)", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Form Data",
          request: {
            method: "POST",
            url: "https://example.com/upload",
            body: {
              mode: "formdata",
              formdata: [
                { key: "name", value: "test", type: "text" },
                { key: "file", value: "", type: "file", disabled: true },
              ],
            },
          },
        },
      ],
    });
    const curl = result.requests[0].curl;
    expect(curl).toContain("name=test");
  });

  it("does not add duplicate Content-Type when header already exists", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Explicit CT",
          request: {
            method: "POST",
            url: "https://example.com/data",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "urlencoded",
              urlencoded: [{ key: "a", value: "b" }],
            },
          },
        },
      ],
    });
    const curl = result.requests[0].curl;
    // Should keep the explicit header, not add urlencoded content type
    const ctMatches = curl.match(/Content-Type/g);
    expect(ctMatches).toHaveLength(1);
  });

  // --- Auth tests ---

  it("parses basic auth", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Auth Test",
          request: {
            method: "GET",
            url: "https://api.example.com",
            auth: {
              type: "basic",
              basic: [
                { key: "username", value: "admin" },
                { key: "password", value: "secret" },
              ],
            },
          },
        },
      ],
    });
    expect(result.requests[0].curl).toContain("-u");
    expect(result.requests[0].curl).toContain("admin:secret");
  });

  it("parses bearer auth", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Bearer Test",
          request: {
            method: "GET",
            url: "https://api.example.com",
            auth: {
              type: "bearer",
              bearer: [{ key: "token", value: "mytoken123" }],
            },
          },
        },
      ],
    });
    expect(result.requests[0].curl).toContain("Authorization: Bearer mytoken123");
  });

  it("parses apikey auth in header", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "API Key Test",
          request: {
            method: "GET",
            url: "https://api.example.com",
            auth: {
              type: "apikey",
              apikey: [
                { key: "key", value: "X-Api-Key" },
                { key: "value", value: "abc123" },
                { key: "in", value: "header" },
              ],
            },
          },
        },
      ],
    });
    expect(result.requests[0].curl).toContain("X-Api-Key: abc123");
  });

  // --- Auth inheritance ---

  it("inherits collection-level auth", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      auth: {
        type: "bearer",
        bearer: [{ key: "token", value: "collection-token" }],
      },
      item: [
        {
          name: "Inherits Auth",
          request: {
            method: "GET",
            url: "https://api.example.com",
          },
        },
      ],
    });
    expect(result.requests[0].curl).toContain("Authorization: Bearer collection-token");
  });

  it("request-level auth overrides collection auth", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      auth: {
        type: "bearer",
        bearer: [{ key: "token", value: "collection-token" }],
      },
      item: [
        {
          name: "Own Auth",
          request: {
            method: "GET",
            url: "https://api.example.com",
            auth: {
              type: "bearer",
              bearer: [{ key: "token", value: "request-token" }],
            },
          },
        },
      ],
    });
    expect(result.requests[0].curl).toContain("request-token");
    expect(result.requests[0].curl).not.toContain("collection-token");
  });

  it("folder-level auth overrides collection auth", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      auth: {
        type: "bearer",
        bearer: [{ key: "token", value: "collection-token" }],
      },
      item: [
        {
          name: "Folder",
          auth: {
            type: "basic",
            basic: [
              { key: "username", value: "admin" },
              { key: "password", value: "pass" },
            ],
          },
          item: [
            {
              name: "In Folder",
              request: {
                method: "GET",
                url: "https://api.example.com",
              },
            },
          ],
        },
      ],
    });
    expect(result.requests[0].curl).toContain("-u");
    expect(result.requests[0].curl).toContain("admin:pass");
    expect(result.requests[0].curl).not.toContain("collection-token");
  });

  // --- Folder/structure tests ---

  it("handles nested folders (recursive items)", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Users",
          item: [
            {
              name: "Get Users",
              request: { method: "GET", url: "https://api.example.com/users" },
            },
            {
              name: "Admin",
              item: [
                {
                  name: "Get Admin",
                  request: { method: "GET", url: "https://api.example.com/admin" },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(result.requests).toHaveLength(2);
    expect(result.requests[0].name).toBe("Get Users");
    expect(result.requests[1].name).toBe("Get Admin");
  });

  it("handles disabled headers", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Header Test",
          request: {
            method: "GET",
            url: "https://api.example.com",
            header: [
              { key: "X-Enabled", value: "yes" },
              { key: "X-Disabled", value: "no", disabled: true },
            ],
          },
        },
      ],
    });
    const curl = result.requests[0].curl;
    expect(curl).toContain("X-Enabled");
    expect(curl).not.toContain("X-Disabled");
  });

  it("handles missing request name", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          request: { method: "GET", url: "https://api.example.com" },
        },
      ],
    });
    expect(result.requests[0].name).toBe("Untitled Request");
  });

  it("handles items with no request (folder without items)", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        { name: "Empty folder" },
        {
          name: "Real Request",
          request: { method: "GET", url: "https://api.example.com" },
        },
      ],
    });
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].name).toBe("Real Request");
  });

  // --- Postman variables ---

  it("preserves Postman variables in URL as-is", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "With Variables",
          request: {
            method: "GET",
            url: "{{base_url}}/api/users",
          },
        },
      ],
    });
    expect(result.requests[0].curl).toContain("{{base_url}}/api/users");
  });

  it("preserves Postman variables in headers", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "Header Var",
          request: {
            method: "GET",
            url: "https://api.example.com",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
          },
        },
      ],
    });
    expect(result.requests[0].curl).toContain("{{token}}");
  });

  // --- Edge case: empty URL ---

  it("handles missing URL gracefully", () => {
    const result = parsePostmanCollection({
      info: { name: "Test" },
      item: [
        {
          name: "No URL",
          request: { method: "GET" },
        },
      ],
    });
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].curl).toContain("curl");
  });
});
