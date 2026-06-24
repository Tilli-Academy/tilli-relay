"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { SearchIcon, FolderIcon } from "@/components/Icons";
import { parseCurl } from "@/lib/curl/parser";

const METHOD_COLORS: Record<string, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  DELETE: "text-method-delete",
  PATCH: "text-method-patch",
};

interface SavedRequest {
  id: string;
  name: string;
  curl: string;
}

interface CollectionWithRequests {
  id: string;
  name: string;
  folderId: string | null;
  requests: Array<{
    id: string;
    request: SavedRequest;
  }>;
}

interface Folder {
  id: string;
  name: string;
  collections: CollectionWithRequests[];
}

type SearchResult =
  | { type: "folder"; item: Folder }
  | { type: "collection"; item: CollectionWithRequests; parent?: string }
  | { type: "request"; item: SavedRequest; parent?: string; method: string; url: string };

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
  collections: CollectionWithRequests[];
  requests: SavedRequest[];
  onLoadRequest: (req: SavedRequest) => void;
}

export default function SearchOverlay({
  open,
  onClose,
  folders,
  collections,
  requests,
  onLoadRequest,
}: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Pre-parse curl strings for URL search
  const parsedRequests = useMemo(() => {
    const allRequests: Array<{ req: SavedRequest; method: string; url: string; parent?: string }> = [];

    // Standalone requests
    for (const req of requests) {
      try {
        const parsed = parseCurl(req.curl);
        allRequests.push({ req, method: parsed.method, url: parsed.url });
      } catch {
        allRequests.push({ req, method: "GET", url: "" });
      }
    }

    // Collection requests
    for (const col of collections) {
      for (const cr of col.requests) {
        try {
          const parsed = parseCurl(cr.request.curl);
          allRequests.push({ req: cr.request, method: parsed.method, url: parsed.url, parent: col.name });
        } catch {
          allRequests.push({ req: cr.request, method: "GET", url: "", parent: col.name });
        }
      }
    }

    // Folder > collection requests
    for (const folder of folders) {
      for (const col of folder.collections) {
        for (const cr of col.requests) {
          try {
            const parsed = parseCurl(cr.request.curl);
            allRequests.push({ req: cr.request, method: parsed.method, url: parsed.url, parent: `${folder.name} / ${col.name}` });
          } catch {
            allRequests.push({ req: cr.request, method: "GET", url: "", parent: `${folder.name} / ${col.name}` });
          }
        }
      }
    }

    return allRequests;
  }, [requests, collections, folders]);

  // Search logic
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    // Search folders
    for (const folder of folders) {
      if (folder.name.toLowerCase().includes(q)) {
        out.push({ type: "folder", item: folder });
      }
    }

    // Search collections (standalone and in folders)
    for (const col of collections) {
      if (col.name.toLowerCase().includes(q)) {
        out.push({ type: "collection", item: col });
      }
    }
    for (const folder of folders) {
      for (const col of folder.collections) {
        if (col.name.toLowerCase().includes(q)) {
          out.push({ type: "collection", item: col, parent: folder.name });
        }
      }
    }

    // Search requests (deduplicate by id)
    const seen = new Set<string>();
    for (const { req, method, url, parent } of parsedRequests) {
      if (seen.has(req.id)) continue;
      if (
        req.name.toLowerCase().includes(q) ||
        url.toLowerCase().includes(q) ||
        method.toLowerCase().includes(q)
      ) {
        seen.add(req.id);
        out.push({ type: "request", item: req, parent, method, url });
      }
    }

    return out.slice(0, 20);
  }, [query, folders, collections, parsedRequests]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (result.type === "request") {
        onLoadRequest(result.item);
        onClose();
      }
      // For folders/collections, just close (could expand in sidebar later)
      onClose();
    },
    [onLoadRequest, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    },
    [results, selectedIndex, handleSelect]
  );

  if (!open) return null;

  return (
    <div
      data-testid="search-overlay-backdrop"
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--overlay-bg)] pt-[15vh]"
      onClick={(e) => {
        if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={overlayRef}
        data-testid="search-overlay"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border-primary bg-surface-primary shadow-2xl"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border-secondary px-4 py-3">
          <SearchIcon size={16} className="shrink-0 text-content-muted" />
          <input
            ref={inputRef}
            data-testid="search-input"
            type="text"
            placeholder="Search requests, collections, folders..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-content-primary placeholder-content-muted outline-none"
          />
          <kbd className="rounded border border-border-primary px-1.5 py-0.5 text-[10px] text-content-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.trim() && results.length === 0 && (
            <div data-testid="search-no-results" className="px-4 py-6 text-center text-xs text-content-muted">
              No results for &quot;{query}&quot;
            </div>
          )}

          {!query.trim() && (
            <div className="px-4 py-6 text-center text-xs text-content-muted">
              Type to search across all requests, collections, and folders
            </div>
          )}

          {results.map((result, i) => (
            <button
              key={`${result.type}-${result.type === "request" ? result.item.id : result.type === "collection" ? result.item.id : result.item.id}-${i}`}
              data-testid={`search-result-${i}`}
              onClick={() => handleSelect(result)}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                i === selectedIndex
                  ? "bg-surface-secondary text-content-primary"
                  : "text-content-tertiary hover:bg-surface-tertiary"
              }`}
            >
              {result.type === "folder" && (
                <>
                  <FolderIcon size={14} className="shrink-0 text-yellow-500/70" />
                  <span className="flex-1 truncate text-xs">{result.item.name}</span>
                  <span className="shrink-0 text-[10px] text-content-dim">Folder</span>
                </>
              )}

              {result.type === "collection" && (
                <>
                  <FolderIcon size={14} className="shrink-0 text-tilli/70" />
                  <span className="flex-1 truncate text-xs">{result.item.name}</span>
                  {result.parent && (
                    <span className="shrink-0 text-[10px] text-content-dim">{result.parent}</span>
                  )}
                  <span className="shrink-0 text-[10px] text-content-dim">Collection</span>
                </>
              )}

              {result.type === "request" && (
                <>
                  <span className={`shrink-0 text-[9px] font-bold ${METHOD_COLORS[result.method] || "text-content-muted"}`}>
                    {result.method}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs">{result.item.name}</span>
                    {result.url && (
                      <span className="truncate text-[10px] text-content-dim">{result.url}</span>
                    )}
                  </div>
                  {result.parent && (
                    <span className="shrink-0 text-[10px] text-content-dim">{result.parent}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-border-secondary px-4 py-2">
          <span className="text-[10px] text-content-dim">
            <kbd className="rounded border border-border-primary px-1 py-0.5 text-[9px]">↑↓</kbd> Navigate
          </span>
          <span className="text-[10px] text-content-dim">
            <kbd className="rounded border border-border-primary px-1 py-0.5 text-[9px]">Enter</kbd> Open
          </span>
          <span className="text-[10px] text-content-dim">
            <kbd className="rounded border border-border-primary px-1 py-0.5 text-[9px]">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
