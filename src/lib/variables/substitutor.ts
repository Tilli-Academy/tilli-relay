const VARIABLE_PATTERN = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

/**
 * Resolves {{VARIABLE}} placeholders in pre-tokenized curl args.
 * Substitution happens per-token so a variable value can never inject new argv entries.
 */
export function resolveVariablesInTokens(
  tokens: string[],
  variables: Map<string, string>
): { resolved: string[]; unresolvedKeys: string[] } {
  const unresolvedKeys: string[] = [];

  const resolved = tokens.map((token) =>
    token.replace(VARIABLE_PATTERN, (match, key: string) => {
      if (variables.has(key)) {
        return variables.get(key)!;
      }
      if (!unresolvedKeys.includes(key)) {
        unresolvedKeys.push(key);
      }
      return match;
    })
  );

  return { resolved, unresolvedKeys };
}

/**
 * Resolves {{VARIABLE}} placeholders in a raw curl string.
 * @deprecated Use resolveVariablesInTokens after tokenization to prevent injection.
 */
export function resolveVariables(
  curl: string,
  variables: Map<string, string>
): { resolved: string; unresolvedKeys: string[] } {
  const unresolvedKeys: string[] = [];

  const resolved = curl.replace(VARIABLE_PATTERN, (match, key: string) => {
    if (variables.has(key)) {
      return variables.get(key)!;
    }
    unresolvedKeys.push(key);
    return match;
  });

  return { resolved, unresolvedKeys };
}
