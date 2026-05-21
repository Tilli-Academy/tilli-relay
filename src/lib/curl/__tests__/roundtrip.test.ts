import { describe, it, expect } from "vitest";
import { buildCurl } from "../builder";
import { parseCurl } from "../parser";
import { RequestState } from "@/lib/types";

/**
 * Roundtrip tests: build curl from state, parse it back, verify fields match.
 */
describe("builder <-> parser roundtrip", () => {
  function roundtrip(state: RequestState) {
    const curl = buildCurl(state);
    return parseCurl(curl);
  }

  it("roundtrips a GET request", () => {
    const state: RequestState = {
      method: "GET",
      url: "https://api.example.com",
      headers: [],
      params: [],
      body: "",
      auth: { type: "none" },
    };
    const parsed = roundtrip(state);
    expect(parsed.method).toBe("GET");
    expect(parsed.url).toBe("https://api.example.com");
  });

  it("roundtrips POST with body", () => {
    const state: RequestState = {
      method: "POST",
      url: "https://api.example.com/data",
      headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
      params: [],
      body: '{"name":"test","value":42}',
      auth: { type: "none" },
    };
    const parsed = roundtrip(state);
    expect(parsed.method).toBe("POST");
    expect(parsed.url).toBe("https://api.example.com/data");
    expect(parsed.headers[0].key).toBe("Content-Type");
    expect(parsed.headers[0].value).toBe("application/json");
    expect(parsed.body).toBe('{"name":"test","value":42}');
  });

  it("roundtrips basic auth", () => {
    const state: RequestState = {
      method: "GET",
      url: "https://api.example.com",
      headers: [],
      params: [],
      body: "",
      auth: { type: "basic", basic: { username: "admin", password: "secret" } },
    };
    const parsed = roundtrip(state);
    expect(parsed.auth.type).toBe("basic");
    expect(parsed.auth.basic?.username).toBe("admin");
    expect(parsed.auth.basic?.password).toBe("secret");
  });

  it("roundtrips bearer auth", () => {
    const state: RequestState = {
      method: "GET",
      url: "https://api.example.com",
      headers: [],
      params: [],
      body: "",
      auth: { type: "bearer", bearer: { token: "jwt.token.here" } },
    };
    const parsed = roundtrip(state);
    expect(parsed.auth.type).toBe("bearer");
    expect(parsed.auth.bearer?.token).toBe("jwt.token.here");
  });

  it("roundtrips multiple headers", () => {
    const state: RequestState = {
      method: "PUT",
      url: "https://api.example.com/item/1",
      headers: [
        { key: "Content-Type", value: "application/json", enabled: true },
        { key: "Accept", value: "application/json", enabled: true },
        { key: "X-Request-Id", value: "abc-123", enabled: true },
      ],
      params: [],
      body: '{"updated":true}',
      auth: { type: "none" },
    };
    const parsed = roundtrip(state);
    expect(parsed.method).toBe("PUT");
    expect(parsed.headers).toHaveLength(3);
    expect(parsed.headers[0].key).toBe("Content-Type");
    expect(parsed.headers[1].key).toBe("Accept");
    expect(parsed.headers[2].key).toBe("X-Request-Id");
    expect(parsed.body).toBe('{"updated":true}');
  });

  it("roundtrips DELETE without body", () => {
    const state: RequestState = {
      method: "DELETE",
      url: "https://api.example.com/item/1",
      headers: [],
      params: [],
      body: "",
      auth: { type: "none" },
    };
    const parsed = roundtrip(state);
    expect(parsed.method).toBe("DELETE");
    expect(parsed.url).toBe("https://api.example.com/item/1");
    expect(parsed.body).toBe("");
  });

  it("disabled headers don't appear after roundtrip", () => {
    const state: RequestState = {
      method: "GET",
      url: "https://api.example.com",
      headers: [
        { key: "X-Active", value: "yes", enabled: true },
        { key: "X-Inactive", value: "no", enabled: false },
      ],
      params: [],
      body: "",
      auth: { type: "none" },
    };
    const parsed = roundtrip(state);
    expect(parsed.headers).toHaveLength(1);
    expect(parsed.headers[0].key).toBe("X-Active");
  });

  it("roundtrips query params", () => {
    const state: RequestState = {
      method: "GET",
      url: "https://api.example.com/search",
      headers: [],
      params: [
        { key: "q", value: "hello world", enabled: true },
        { key: "page", value: "2", enabled: true },
      ],
      body: "",
      auth: { type: "none" },
    };
    const parsed = roundtrip(state);
    expect(parsed.url).toBe("https://api.example.com/search");
    expect(parsed.params).toHaveLength(2);
    expect(parsed.params[0]).toEqual({ key: "q", value: "hello world", enabled: true });
    expect(parsed.params[1]).toEqual({ key: "page", value: "2", enabled: true });
  });

  it("disabled params don't appear after roundtrip", () => {
    const state: RequestState = {
      method: "GET",
      url: "https://api.example.com",
      headers: [],
      params: [
        { key: "active", value: "yes", enabled: true },
        { key: "debug", value: "true", enabled: false },
      ],
      body: "",
      bodyType: "none",
      formData: [],
      auth: { type: "none" },
    };
    const parsed = roundtrip(state);
    expect(parsed.params).toHaveLength(1);
    expect(parsed.params[0].key).toBe("active");
  });

  it("roundtrips form-data with text fields", () => {
    const state: RequestState = {
      method: "POST",
      url: "https://api.example.com/submit",
      headers: [],
      params: [],
      body: "",
      bodyType: "form-data",
      formData: [
        { key: "name", value: "test", type: "text", enabled: true },
        { key: "email", value: "a@b.com", type: "text", enabled: true },
      ],
      auth: { type: "none" },
    };
    const parsed = roundtrip(state);
    expect(parsed.bodyType).toBe("form-data");
    expect(parsed.formData).toHaveLength(2);
    expect(parsed.formData[0]).toMatchObject({ key: "name", value: "test", type: "text" });
    expect(parsed.formData[1]).toMatchObject({ key: "email", value: "a@b.com", type: "text" });
  });

  it("roundtrips form-data with file fields", () => {
    const state: RequestState = {
      method: "POST",
      url: "https://api.example.com/upload",
      headers: [],
      params: [],
      body: "",
      bodyType: "form-data",
      formData: [
        { key: "file", value: "/tmp/reqify-uploads/user/abc.txt", type: "file", enabled: true },
      ],
      auth: { type: "none" },
    };
    const parsed = roundtrip(state);
    expect(parsed.bodyType).toBe("form-data");
    expect(parsed.formData[0].type).toBe("file");
    expect(parsed.formData[0].value).toBe("/tmp/reqify-uploads/user/abc.txt");
  });
});
