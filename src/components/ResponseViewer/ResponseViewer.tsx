"use client";

import React, { useState, useMemo, useCallback } from "react";
import { ExecutionResult } from "@/lib/types";
import ResponseHistory, { HistoryEntry } from "./ResponseHistory";
import ResponseSizeIndicator from "./ResponseSizeIndicator";
import PaginatedRawView from "./PaginatedRawView";
import JsonTreeViewer from "./JsonTreeViewer";
import { ClipboardIcon, CheckIcon } from "@/components/Icons";

type Tab = "body" | "headers" | "history";
type ViewMode = "pretty" | "raw";

const JSON_HIGHLIGHT_MAX_LENGTH = 100_000;
const LARGE_RESPONSE_THRESHOLD = 50_000;

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tryParseJson(body: string): unknown | undefined {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function highlightJson(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}[\],])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`w${i++}`}>{text.slice(lastIndex, match.index)}</span>);
    }

    if (match[1] && match[2]) {
      parts.push(<span key={`k${i++}`} className="text-syntax-key">{match[1]}</span>);
      parts.push(<span key={`c${i++}`} className="text-syntax-punctuation">{match[2]}</span>);
    } else if (match[1]) {
      parts.push(<span key={`s${i++}`} className="text-syntax-string">{match[1]}</span>);
    } else if (match[3]) {
      parts.push(<span key={`n${i++}`} className="text-syntax-number">{match[3]}</span>);
    } else if (match[4]) {
      parts.push(<span key={`b${i++}`} className="text-syntax-boolean">{match[4]}</span>);
    } else if (match[5]) {
      parts.push(<span key={`u${i++}`} className="text-syntax-null">{match[5]}</span>);
    } else if (match[6]) {
      parts.push(<span key={`p${i++}`} className="text-syntax-punctuation">{match[6]}</span>);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`e${i}`}>{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

export default function ResponseViewer({
  result,
  sending,
  history,
  onSelectHistory,
  onClearHistory,
}: {
  result: ExecutionResult | null;
  sending?: boolean;
  history?: HistoryEntry[];
  onSelectHistory?: (entry: HistoryEntry) => void;
  onClearHistory?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("body");
  const [viewMode, setViewMode] = useState<ViewMode>("pretty");
  const [copied, setCopied] = useState(false);

  const parsedJson = useMemo(() => {
    if (!result?.body) return undefined;
    return tryParseJson(result.body);
  }, [result?.body]);

  const isJson = parsedJson !== undefined;

  const formattedJson = useMemo(() => {
    if (!isJson) return "";
    return JSON.stringify(parsedJson, null, 2);
  }, [isJson, parsedJson]);

  const bodySize = useMemo(
    () => (result?.body ? new TextEncoder().encode(result.body).length : 0),
    [result?.body]
  );

  const lineCount = useMemo(
    () => (result?.body ? result.body.split("\n").length : 0),
    [result?.body]
  );

  const isLarge = bodySize > LARGE_RESPONSE_THRESHOLD;

  const contentTypeLabel = useMemo(() => {
    if (!result) return "";
    const ct = result.headers["content-type"] || result.headers["Content-Type"] || "";
    if (isJson) return "JSON";
    if (ct.includes("html")) return "HTML";
    if (ct.includes("xml")) return "XML";
    return "Text";
  }, [result, isJson]);

  const headerCount = result ? Object.keys(result.headers).length : 0;

  const jsonHighlighter = useCallback(
    (text: string) => {
      if (text.length > JSON_HIGHLIGHT_MAX_LENGTH) return text;
      return highlightJson(text);
    },
    []
  );

  const handleCopy = useCallback(async () => {
    if (!result?.body) return;
    try {
      await navigator.clipboard.writeText(result.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = result.body;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result?.body]);

  if (sending) {
    return (
      <div data-testid="response-sending" className="flex h-full flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-border-primary border-t-tilli" />
          <div className="absolute inset-0 h-10 w-10 animate-ping rounded-full border border-tilli/20" />
        </div>
        <p className="text-sm font-medium text-content-tertiary">Sending request...</p>
        <p className="text-xs text-content-dim">Executing curl command</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div data-testid="response-empty" className="flex h-full flex-col items-center justify-center gap-2">
        <div className="text-content-dim">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <p className="text-sm text-content-muted">Send a request to see the response</p>
        <p className="text-xs text-content-dim">Ctrl+Enter from the URL bar</p>
      </div>
    );
  }

  if (result.error && result.status === 0) {
    return (
      <div data-testid="response-error" className="flex h-full flex-col items-center justify-center gap-2">
        <div className="text-red-500">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-sm font-medium text-red-400">Request Failed</p>
        <p data-testid="response-error-message" className="max-w-md text-center text-xs text-content-tertiary">{result.error}</p>
      </div>
    );
  }

  const statusColor =
    result.status >= 200 && result.status < 300
      ? "text-status-success-text"
      : result.status >= 300 && result.status < 400
        ? "text-status-warning-text"
        : "text-status-error-text";

  const statusBg =
    result.status >= 200 && result.status < 300
      ? "bg-status-success-bg"
      : result.status >= 300 && result.status < 400
        ? "bg-status-warning-bg"
        : "bg-status-error-bg";

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div className="mb-2 flex items-center gap-3">
        <span data-testid="response-status" className={`rounded px-2 py-0.5 text-xs font-bold ${statusColor} ${statusBg}`}>
          {result.status} {STATUS_TEXT[result.status] || ""}
        </span>
        <span data-testid="response-time" className="text-xs text-content-muted">{result.timeMs}ms</span>
        <span data-testid="response-size" className="text-xs text-content-muted">{formatBytes(bodySize)}</span>
      </div>

      {/* Warning banner */}
      {result.warning && (
        <div data-testid="response-warning" className="mb-2 rounded bg-status-warning-bg px-3 py-1.5 text-xs text-status-warning-text">
          {result.warning}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-2 flex gap-1 border-b border-border-secondary">
        <button
          data-testid="response-tab-body"
          onClick={() => setTab("body")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "body"
              ? "border-b-2 border-tilli text-tilli-light"
              : "text-content-muted hover:text-content-secondary"
          }`}
        >
          Body
        </button>
        <button
          data-testid="response-tab-headers"
          onClick={() => setTab("headers")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "headers"
              ? "border-b-2 border-tilli text-tilli-light"
              : "text-content-muted hover:text-content-secondary"
          }`}
        >
          Headers
          {headerCount > 0 && (
            <span className="ml-1.5 rounded-full bg-surface-secondary px-1.5 py-0.5 text-[10px] text-content-secondary">
              {headerCount}
            </span>
          )}
        </button>
        {history && (
          <button
            data-testid="response-tab-history"
            onClick={() => setTab("history")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "history"
                ? "border-b-2 border-tilli text-tilli-light"
                : "text-content-muted hover:text-content-secondary"
            }`}
          >
            History
            {history.length > 0 && (
              <span className="ml-1.5 rounded-full bg-surface-secondary px-1.5 py-0.5 text-[10px] text-content-secondary">
                {history.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "body" && (
          <div data-testid="response-body">
            {/* Response metadata + controls */}
            <div className="mb-2 flex items-center justify-between">
              <ResponseSizeIndicator
                bodySize={bodySize}
                lineCount={lineCount}
                contentType={contentTypeLabel}
                isLarge={isLarge}
              />
              <div className="flex items-center gap-2">
                {isJson && (
                  <div className="flex rounded border border-border-primary">
                    <button
                      data-testid="response-view-pretty"
                      onClick={() => setViewMode("pretty")}
                      className={`px-2 py-0.5 text-[11px] transition-colors ${
                        viewMode === "pretty"
                          ? "bg-surface-secondary text-content-primary"
                          : "text-content-muted hover:text-content-secondary"
                      }`}
                    >
                      Pretty
                    </button>
                    <button
                      data-testid="response-view-raw"
                      onClick={() => setViewMode("raw")}
                      className={`px-2 py-0.5 text-[11px] transition-colors ${
                        viewMode === "raw"
                          ? "bg-surface-secondary text-content-primary"
                          : "text-content-muted hover:text-content-secondary"
                      }`}
                    >
                      Raw
                    </button>
                  </div>
                )}
                <button
                  data-testid="response-copy"
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-content-muted transition-colors hover:bg-surface-secondary hover:text-content-secondary"
                  title="Copy response body"
                >
                  {copied ? (
                    <><CheckIcon size={12} className="text-green-400" /> Copied</>
                  ) : (
                    <><ClipboardIcon size={12} /> Copy</>
                  )}
                </button>
              </div>
            </div>

            {/* Body content */}
            {isJson && viewMode === "pretty" ? (
              <JsonTreeViewer data={parsedJson} />
            ) : (
              <PaginatedRawView
                text={isJson ? formattedJson : (result.body || "(empty body)")}
                highlighter={isJson && formattedJson.length <= JSON_HIGHLIGHT_MAX_LENGTH ? jsonHighlighter : undefined}
              />
            )}
          </div>
        )}
        {tab === "headers" && (
          <div data-testid="response-headers-table" className="rounded bg-surface-primary p-3">
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(result.headers).map(([key, value]) => (
                  <tr key={key} className="border-b border-border-secondary">
                    <td className="whitespace-nowrap py-1.5 pr-4 font-medium text-content-tertiary">
                      {key}
                    </td>
                    <td className="break-all py-1.5 text-content-secondary">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === "history" && history && onSelectHistory && onClearHistory && (
          history.length > 0 ? (
            <ResponseHistory
              history={history}
              onSelect={onSelectHistory}
              onClear={onClearHistory}
            />
          ) : (
            <div data-testid="history-empty" className="flex flex-col items-center justify-center gap-2 py-8">
              <p className="text-xs text-content-muted">No history yet</p>
              <p className="text-[10px] text-content-dim">Send a request to start recording history</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
