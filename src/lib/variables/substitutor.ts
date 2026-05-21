const VARIABLE_PATTERN = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

/**
 * Resolves {{VARIABLE}} placeholders in a curl string using the provided variable map.
 * Unresolved variables are left in place so the command fails visibly.
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
