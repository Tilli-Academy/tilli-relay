"use client";

import { useEffect, useState } from "react";
import { api, getApiBase } from "@/lib/apiBase";

type PageProps = { params: Promise<{ token: string }> };

interface SharedRequest {
  name: string;
  curl: string;
  method: string;
  url: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  DELETE: "text-method-delete",
  PATCH: "text-method-patch",
};

export default function SharedRequestPage({ params }: PageProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharedRequest | null>(null);
  const [error, setError] = useState<"expired" | "not_found" | "error" | null>(null);
  const [copied, setCopied] = useState(false);

  // Unwrap the params promise
  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  // Fetch the shared request once we have the token
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function fetchShare() {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const res = await fetch(api(`/api/share/${token}`));

        if (!cancelled) {
          if (res.ok) {
            const json = await res.json();
            setData(json);
          } else if (res.status === 410) {
            setError("expired");
          } else if (res.status === 404) {
            setError("not_found");
          } else {
            setError("error");
          }
        }
      } catch {
        if (!cancelled) {
          setError("error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchShare();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleCopy = async () => {
    if (!data?.curl) return;
    try {
      await navigator.clipboard.writeText(data.curl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = data.curl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-secondary border-t-content-tertiary" />
          <p className="text-sm text-content-muted">Loading shared request...</p>
        </div>
      </div>
    );
  }

  // Expired state
  if (error === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base px-4">
        <div className="w-full max-w-md rounded-xl border border-border-primary bg-surface-primary p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-900/30">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white">Link Expired</h1>
          <p className="mt-2 text-sm text-content-tertiary">
            This shared link has expired and is no longer accessible. Ask the owner to generate a new link.
          </p>
          <a
            href={getApiBase() + "/"}
            className="mt-6 inline-block rounded-lg bg-surface-secondary px-4 py-2 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-secondary hover:text-white"
          >
            Go to Relay
          </a>
        </div>
      </div>
    );
  }

  // Not found state
  if (error === "not_found") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base px-4">
        <div className="w-full max-w-md rounded-xl border border-border-primary bg-surface-primary p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-900/30">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white">Not Found</h1>
          <p className="mt-2 text-sm text-content-tertiary">
            This shared link does not exist or has been revoked.
          </p>
          <a
            href={getApiBase() + "/"}
            className="mt-6 inline-block rounded-lg bg-surface-secondary px-4 py-2 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-secondary hover:text-white"
          >
            Go to Relay
          </a>
        </div>
      </div>
    );
  }

  // Generic error state
  if (error === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base px-4">
        <div className="w-full max-w-md rounded-xl border border-border-primary bg-surface-primary p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-900/30">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white">Something Went Wrong</h1>
          <p className="mt-2 text-sm text-content-tertiary">
            Failed to load the shared request. Please try again later.
          </p>
          <a
            href={getApiBase() + "/"}
            className="mt-6 inline-block rounded-lg bg-surface-secondary px-4 py-2 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-secondary hover:text-white"
          >
            Go to Relay
          </a>
        </div>
      </div>
    );
  }

  // Success state — show the shared request
  if (!data) return null;

  const methodColor = METHOD_COLORS[data.method.toUpperCase()] || "text-content-tertiary";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Card */}
        <div className="rounded-xl border border-border-primary bg-surface-primary p-6">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold text-white">{data.name}</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className={`text-xs font-bold uppercase ${methodColor}`}>
                  {data.method}
                </span>
                <span className="truncate text-sm text-content-tertiary">{data.url}</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mb-4 border-t border-border-primary" />

          {/* Curl command */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wider text-content-muted">
                curl Command
              </h2>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md bg-surface-secondary px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-secondary hover:text-white"
              >
                {copied ? (
                  <>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-border-primary bg-surface-secondary p-4 font-mono text-sm text-content-primary">
              {data.curl}
            </pre>
          </div>
        </div>

        {/* Footer link */}
        <div className="mt-6 text-center">
          <a
            href={getApiBase() + "/"}
            className="text-sm text-content-muted transition-colors hover:text-content-secondary"
          >
            Open Relay
          </a>
        </div>
      </div>
    </div>
  );
}
