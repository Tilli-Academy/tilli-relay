/**
 * Test data generators — each produces unique names to avoid cross-test collisions.
 */

/** Local mock server URL — replaces httpbin.org for reliable tests */
export const MOCK_BASE = "http://localhost:9444";

let counter = 0;

export function uniqueId(): string {
  return `${Date.now()}-${++counter}-${Math.random().toString(36).slice(2, 7)}`;
}

export function uniqueRequestName(prefix = "Req"): string {
  return `${prefix} ${uniqueId()}`;
}

export function uniqueCollectionName(prefix = "Coll"): string {
  return `${prefix} ${uniqueId()}`;
}

export function uniqueFolderName(prefix = "Folder"): string {
  return `${prefix} ${uniqueId()}`;
}

export function uniqueEnvName(prefix = "Env"): string {
  return `${prefix} ${uniqueId()}`;
}

export function uniqueTeamName(prefix = "Team"): string {
  return `${prefix} ${uniqueId()}`;
}

/**
 * Returns a minimal Postman Collection v2.1 JSON with 2 requests.
 */
export function samplePostmanCollection(name: string) {
  return {
    info: {
      name,
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: [
      {
        name: "Get Users",
        request: {
          method: "GET",
          header: [],
          url: {
            raw: "https://httpbin.org/get?page=1",
            protocol: "https",
            host: ["httpbin", "org"],
            path: ["get"],
            query: [{ key: "page", value: "1" }],
          },
        },
      },
      {
        name: "Create User",
        request: {
          method: "POST",
          header: [
            { key: "Content-Type", value: "application/json" },
          ],
          body: {
            mode: "raw",
            raw: '{"name":"Test User","email":"test@example.com"}',
          },
          url: {
            raw: "https://httpbin.org/post",
            protocol: "https",
            host: ["httpbin", "org"],
            path: ["post"],
          },
        },
      },
    ],
  };
}
