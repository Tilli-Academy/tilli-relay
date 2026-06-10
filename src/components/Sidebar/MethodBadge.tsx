import { parseCurl } from "@/lib/curl/parser";

export const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-400",
  POST: "text-yellow-400",
  PUT: "text-blue-400",
  DELETE: "text-red-400",
  PATCH: "text-purple-400",
};

export function getMethodFromCurl(curl: string): string {
  try {
    return parseCurl(curl).method;
  } catch {
    return "GET";
  }
}

export function MethodBadge({ curl }: { curl: string }) {
  const method = getMethodFromCurl(curl);
  return (
    <span className={`mr-1.5 shrink-0 text-[9px] font-bold ${METHOD_COLORS[method] || "text-content-muted"}`}>
      {method}
    </span>
  );
}
