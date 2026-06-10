"use client";

import { ExecutionResult } from "@/lib/types";

export interface HistoryEntry {
  id: string | number;
  method: string;
  url: string;
  status: number;
  timeMs: number;
  timestamp: number;
  result: ExecutionResult;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-400",
  POST: "text-yellow-400",
  PUT: "text-blue-400",
  DELETE: "text-red-400",
  PATCH: "text-purple-400",
};

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-green-400";
  if (status >= 300 && status < 400) return "text-yellow-400";
  return "text-red-400";
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export default function ResponseHistory({
  history,
  onSelect,
  onClear,
}: {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  if (history.length === 0) {
    return (
      <div data-testid="history-empty" className="flex h-full flex-col items-center justify-center gap-2 py-8">
        <p className="text-xs text-content-muted">No history yet</p>
        <p className="text-[10px] text-content-dim">Send requests to build history</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] text-content-muted">{history.length} request{history.length !== 1 ? "s" : ""}</span>
        <button
          data-testid="history-clear-button"
          onClick={onClear}
          className="text-[10px] text-content-dim transition-colors hover:text-red-400"
        >
          Clear
        </button>
      </div>
      {history.map((entry, index) => (
        <button
          key={entry.id}
          data-testid={`history-entry-${index}`}
          onClick={() => onSelect(entry)}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-surface-secondary"
        >
          <span data-testid={`history-entry-method-${index}`} className={`shrink-0 text-[9px] font-bold ${METHOD_COLORS[entry.method] || "text-content-muted"}`}>
            {entry.method}
          </span>
          <span data-testid={`history-entry-url-${index}`} className="min-w-0 flex-1 truncate text-xs text-content-tertiary">
            {entry.url}
          </span>
          <span data-testid={`history-entry-status-${index}`} className={`shrink-0 text-[10px] font-medium ${statusColor(entry.status)}`}>
            {entry.status}
          </span>
          <span className="shrink-0 text-[10px] text-content-dim">
            {entry.timeMs}ms
          </span>
          <span className="shrink-0 text-[10px] text-content-faint">
            {timeAgo(entry.timestamp)}
          </span>
        </button>
      ))}
    </div>
  );
}
