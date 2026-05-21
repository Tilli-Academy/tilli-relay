"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { XIcon, TrashIcon } from "@/components/Icons";
import { showToast } from "@/components/Toast/Toast";
import { api } from "@/lib/apiBase";

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  requestId: string | null;
  requestName: string;
}

interface ShareLink {
  id: string;
  token: string;
  expiresAt: string | null;
  createdAt: string;
}

type Expiration = "1h" | "24h" | "7d" | "never";

const EXPIRATION_OPTIONS: { value: Expiration; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "never", label: "Never" },
];

function expirationToHours(exp: Expiration): number | undefined {
  switch (exp) {
    case "1h":
      return 1;
    case "24h":
      return 24;
    case "7d":
      return 168;
    case "never":
      return undefined;
  }
}

function formatExpiration(expiresAt: string | null): string {
  if (!expiresAt) return "Never expires";
  const date = new Date(expiresAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "Expired";
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `Expires in ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Expires in ${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  return `Expires in ${diffDays}d`;
}

function buildShareUrl(token: string): string {
  return `${window.location.origin}/shared/${token}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern clipboard API first
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  // Fallback for non-HTTPS / proxy environments
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export default function ShareDialog({ open, onClose, requestId, requestName }: ShareDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expiration, setExpiration] = useState<Expiration>("24h");
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  // Fetch existing share links
  const fetchLinks = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const res = await fetch(api(`/api/share?requestId=${requestId}`));
      if (res.ok) {
        const data: ShareLink[] = await res.json();
        setLinks(data);
      } else {
        showToast("Failed to load share links", "error");
      }
    } catch {
      showToast("Failed to load share links", "error");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  // Load links when dialog opens
  useEffect(() => {
    if (open && requestId) {
      fetchLinks();
    }
    if (!open) {
      setLinks([]);
      setExpiration("24h");
    }
  }, [open, requestId, fetchLinks]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  // Create a new share link
  const handleCreateLink = useCallback(async () => {
    if (!requestId) return;
    setCreating(true);
    try {
      const hours = expirationToHours(expiration);
      const body: Record<string, unknown> = { requestId };
      if (hours !== undefined) {
        body.expiresInHours = hours;
      }
      const res = await fetch(api("/api/share"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data: { token: string; url: string; expiresAt: string | null } = await res.json();
        const shareUrl = buildShareUrl(data.token);
        const copied = await copyToClipboard(shareUrl);
        if (copied) {
          showToast("Link created and copied to clipboard", "success");
        } else {
          showToast("Link created", "success");
        }
        fetchLinks();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to create share link", "error");
      }
    } catch {
      showToast("Failed to create share link", "error");
    } finally {
      setCreating(false);
    }
  }, [requestId, expiration, fetchLinks]);

  // Revoke a share link
  const handleRevoke = useCallback(
    async (token: string) => {
      setRevokingToken(token);
      try {
        const res = await fetch(api(`/api/share/${token}`), {
          method: "DELETE",
        });
        if (res.ok) {
          showToast("Share link revoked", "info");
          fetchLinks();
        } else {
          const data = await res.json();
          showToast(data.error || "Failed to revoke link", "error");
        }
      } catch {
        showToast("Failed to revoke link", "error");
      } finally {
        setRevokingToken(null);
      }
    },
    [fetchLinks]
  );

  // Copy an existing link
  const handleCopyLink = useCallback(async (token: string) => {
    const url = buildShareUrl(token);
    const copied = await copyToClipboard(url);
    if (copied) {
      showToast("Link copied to clipboard", "success");
    } else {
      showToast("Failed to copy link", "error");
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-bg)]"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="flex w-[480px] flex-col rounded-lg border border-border-primary bg-surface-primary shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-secondary px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xs font-semibold text-content-primary">Share Request</h2>
            <p className="mt-0.5 truncate text-[11px] text-content-muted" title={requestName}>
              {requestName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 shrink-0 rounded p-1 text-content-muted transition-colors hover:bg-surface-secondary hover:text-content-secondary"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Create Link */}
        <div className="border-b border-border-secondary px-4 py-3">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
            Create New Link
          </label>
          <div className="flex items-center gap-2">
            <select
              value={expiration}
              onChange={(e) => setExpiration(e.target.value as Expiration)}
              className="rounded border border-border-primary bg-surface-secondary px-2 py-1.5 text-xs text-content-primary focus:border-tilli focus:outline-none"
            >
              {EXPIRATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreateLink}
              disabled={creating || !requestId}
              className="rounded bg-tilli px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-tilli-light disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Link"}
            </button>
          </div>
        </div>

        {/* Active Links */}
        <div className="max-h-[320px] flex-1 overflow-y-auto px-4 py-3">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
            Active Links ({links.length})
          </label>

          {loading && links.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <p className="text-xs text-content-muted">Loading links...</p>
            </div>
          ) : links.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <p className="text-xs text-content-muted">No active share links.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((link) => {
                const url = buildShareUrl(link.token);
                const isRevoking = revokingToken === link.token;
                return (
                  <div
                    key={link.id}
                    className="rounded border border-border-secondary bg-surface-tertiary px-3 py-2"
                  >
                    {/* Link URL */}
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate text-[11px] text-content-secondary" title={url}>
                        {url}
                      </code>
                      <button
                        onClick={() => handleCopyLink(link.token)}
                        title="Copy link"
                        className="shrink-0 rounded p-1 text-content-muted transition-colors hover:bg-surface-secondary hover:text-content-secondary"
                      >
                        <svg
                          width={12}
                          height={12}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="9" y="2" width="6" height="4" rx="1" />
                          <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRevoke(link.token)}
                        disabled={isRevoking}
                        title="Revoke link"
                        className="shrink-0 rounded p-1 text-content-dim transition-colors hover:bg-surface-secondary hover:text-red-400 disabled:opacity-50"
                      >
                        <TrashIcon size={12} />
                      </button>
                    </div>
                    {/* Metadata */}
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-content-muted">
                      <span>{formatExpiration(link.expiresAt)}</span>
                      <span>
                        Created{" "}
                        {new Date(link.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
