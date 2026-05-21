import { describe, it, expect } from "vitest";
import { resolveVariables } from "../substitutor";

describe("resolveVariables", () => {
  it("replaces a single variable in a URL", () => {
    const vars = new Map([["BASE_URL", "https://api.example.com"]]);
    const { resolved, unresolvedKeys } = resolveVariables(
      "curl '{{BASE_URL}}/posts/1'",
      vars
    );
    expect(resolved).toBe("curl 'https://api.example.com/posts/1'");
    expect(unresolvedKeys).toEqual([]);
  });

  it("replaces multiple different variables", () => {
    const vars = new Map([
      ["HOST", "https://api.example.com"],
      ["TOKEN", "abc123"],
    ]);
    const { resolved, unresolvedKeys } = resolveVariables(
      "curl -H 'Authorization: Bearer {{TOKEN}}' '{{HOST}}/data'",
      vars
    );
    expect(resolved).toBe(
      "curl -H 'Authorization: Bearer abc123' 'https://api.example.com/data'"
    );
    expect(unresolvedKeys).toEqual([]);
  });

  it("replaces the same variable appearing multiple times", () => {
    const vars = new Map([["VAL", "x"]]);
    const { resolved } = resolveVariables("{{VAL}}-{{VAL}}-{{VAL}}", vars);
    expect(resolved).toBe("x-x-x");
  });

  it("leaves unresolved variables untouched and reports them", () => {
    const vars = new Map([["A", "1"]]);
    const { resolved, unresolvedKeys } = resolveVariables(
      "{{A}}-{{B}}-{{C}}",
      vars
    );
    expect(resolved).toBe("1-{{B}}-{{C}}");
    expect(unresolvedKeys).toEqual(["B", "C"]);
  });

  it("returns empty unresolvedKeys when all variables are resolved", () => {
    const vars = new Map([["X", "y"]]);
    const { unresolvedKeys } = resolveVariables("{{X}}", vars);
    expect(unresolvedKeys).toEqual([]);
  });

  it("handles curl with no variables (passthrough)", () => {
    const vars = new Map([["UNUSED", "val"]]);
    const input = "curl -X GET 'https://example.com'";
    const { resolved, unresolvedKeys } = resolveVariables(input, vars);
    expect(resolved).toBe(input);
    expect(unresolvedKeys).toEqual([]);
  });

  it("does not replace malformed patterns like {VAR} or {{ VAR }}", () => {
    const vars = new Map([["VAR", "replaced"]]);
    const { resolved } = resolveVariables(
      "{VAR} {{ VAR }} {{{VAR}}} {{VAR}}",
      vars
    );
    // {{{VAR}}} → the regex matches {{VAR}} inside it, leaving "{" + "replaced" + "}"
    expect(resolved).toBe("{VAR} {{ VAR }} {replaced} replaced");
  });

  it("handles variables in header values", () => {
    const vars = new Map([["API_KEY", "sk-secret"]]);
    const { resolved } = resolveVariables(
      "curl -H 'X-Api-Key: {{API_KEY}}' 'https://api.com'",
      vars
    );
    expect(resolved).toBe("curl -H 'X-Api-Key: sk-secret' 'https://api.com'");
  });

  it("handles variables in body content", () => {
    const vars = new Map([["USER_ID", "42"]]);
    const { resolved } = resolveVariables(
      "curl -d '{\"userId\": \"{{USER_ID}}\"}' 'https://api.com'",
      vars
    );
    expect(resolved).toBe(
      "curl -d '{\"userId\": \"42\"}' 'https://api.com'"
    );
  });

  it("handles empty variable map", () => {
    const { resolved, unresolvedKeys } = resolveVariables(
      "{{A}} and {{B}}",
      new Map()
    );
    expect(resolved).toBe("{{A}} and {{B}}");
    expect(unresolvedKeys).toEqual(["A", "B"]);
  });

  it("does not perform recursive substitution", () => {
    const vars = new Map([
      ["VAR1", "{{VAR2}}"],
      ["VAR2", "final"],
    ]);
    const { resolved } = resolveVariables("{{VAR1}}", vars);
    expect(resolved).toBe("{{VAR2}}");
  });

  it("handles variable keys with underscores and numbers", () => {
    const vars = new Map([["my_var_2", "ok"]]);
    const { resolved } = resolveVariables("{{my_var_2}}", vars);
    expect(resolved).toBe("ok");
  });

  it("does not match keys starting with a digit", () => {
    const vars = new Map([["2FAST", "nope"]]);
    const { resolved } = resolveVariables("{{2FAST}}", vars);
    expect(resolved).toBe("{{2FAST}}");
  });
});
