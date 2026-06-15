"use client";

import { forwardRef } from "react";
import { HttpMethod } from "@/lib/types";
import { ChevronDownIcon, SendIcon } from "@/components/Icons";

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  DELETE: "text-method-delete",
  PATCH: "text-method-patch",
};

interface Param {
  key: string;
  value: string;
  enabled: boolean;
}

const MethodUrlBar = forwardRef<
  HTMLInputElement,
  {
    method: HttpMethod;
    url: string;
    params?: Param[];
    sending: boolean;
    onMethodChange: (m: HttpMethod) => void;
    onUrlChange: (url: string) => void;
    onSend: () => void;
  }
>(function MethodUrlBar({ method, url, params, sending, onMethodChange, onUrlChange, onSend }, ref) {
  // Build display URL by appending enabled params as query string
  const displayUrl = (() => {
    if (!params) return url;
    const active = params.filter((p) => p.enabled && p.key);
    if (active.length === 0) return url;
    const qs = active.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
    return `${url}?${qs}`;
  })();

  return (
    <div className="flex gap-2">
      <div className="relative">
        <select
          data-testid="method-select"
          value={method}
          onChange={(e) => onMethodChange(e.target.value as HttpMethod)}
          className={`w-28 appearance-none rounded border border-border-primary bg-surface-secondary py-2 pl-3 pr-8 text-sm font-bold focus:border-tilli focus:outline-none ${METHOD_COLORS[method]}`}
        >
          {(["GET", "POST", "PUT", "DELETE", "PATCH"] as HttpMethod[]).map((m) => (
            <option key={m} value={m} className="text-content-primary">
              {m}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted"
        />
      </div>

      <input
        ref={ref}
        data-testid="url-input"
        type="text"
        placeholder="https://api.example.com/endpoint"
        value={displayUrl}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSend();
        }}
        className="flex-1 rounded border border-border-primary bg-surface-secondary px-3 py-2 text-sm text-content-primary placeholder-content-muted focus:border-tilli focus:outline-none"
      />

      <button
        data-testid="send-button"
        onClick={onSend}
        disabled={sending}
        className="tilli-gradient flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-md shadow-tilli/20 transition-all hover:opacity-90 hover:shadow-lg hover:shadow-tilli/30 disabled:opacity-60 disabled:shadow-none"
      >
        {sending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Sending...
          </>
        ) : (
          <>
            <SendIcon size={16} />
            Send
          </>
        )}
      </button>
    </div>
  );
});

export default MethodUrlBar;
