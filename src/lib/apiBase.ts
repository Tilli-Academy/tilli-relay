/**
 * Detects the base path for API calls.
 * Handles code-server proxy URLs like /proxy/3002/
 */
export function getApiBase(): string {
  if (typeof window === "undefined") return "";
  const match = window.location.pathname.match(/^(\/proxy\/\d+)/);
  return match ? match[1] : "";
}

export function api(path: string): string {
  return `${getApiBase()}${path}`;
}
