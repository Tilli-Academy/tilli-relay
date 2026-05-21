"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronRightIcon, ChevronDownIcon, TrashIcon, UnlinkIcon, FolderIcon, InboxIcon, PlusIcon, KeyIcon, UploadIcon, DownloadIcon } from "@/components/Icons";
import { parseCurl } from "@/lib/curl/parser";
import { buildCurl } from "@/lib/curl/builder";
import { LOGO_SRC } from "@/lib/logo";
import { HttpMethod } from "@/lib/types";
import { api } from "@/lib/apiBase";
import WorkspaceSwitcher, { type TeamInfo } from "@/components/WorkspaceSwitcher/WorkspaceSwitcher";
import type { Workspace, TeamRole } from "@/hooks/useWorkspace";


const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-400",
  POST: "text-yellow-400",
  PUT: "text-blue-400",
  DELETE: "text-red-400",
  PATCH: "text-purple-400",
};

function getMethodFromCurl(curl: string): string {
  try {
    return parseCurl(curl).method;
  } catch {
    return "GET";
  }
}

function MethodBadge({ curl }: { curl: string }) {
  const method = getMethodFromCurl(curl);
  return (
    <span className={`mr-1.5 shrink-0 text-[9px] font-bold ${METHOD_COLORS[method] || "text-content-muted"}`}>
      {method}
    </span>
  );
}

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

// ─── Plus Menu Dropdown ────────────────────────────────────────────────
function PlusMenu({
  items,
}: {
  items: { label: string; icon: React.ReactNode; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        title="Add"
        className="rounded p-0.5 text-content-muted transition-colors hover:bg-surface-secondary hover:text-content-secondary"
      >
        <PlusIcon size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-md border border-border-primary bg-surface-primary py-1 shadow-xl">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { setOpen(false); item.onClick(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-content-secondary transition-colors hover:bg-surface-secondary"
            >
              <span className="shrink-0 text-content-muted">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inline Name Input ─────────────────────────────────────────────────
function InlineInput({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  return (
    <div ref={ref} className="my-1 flex gap-1">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
        className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1 text-xs text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
      />
      <button
        onClick={() => value.trim() && onSubmit(value.trim())}
        className="rounded bg-tilli px-2 py-1 text-xs text-white hover:bg-tilli-light"
      >
        Add
      </button>
    </div>
  );
}

// ─── Inline Request Input (method + name + URL) ─────────────────────────
const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

function RequestInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, method: string, url: string) => void;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState<string>("GET");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), method, url.trim());
  };

  return (
    <div ref={ref} className="my-1 space-y-1 rounded border border-border-primary bg-surface-tertiary p-2">
      <div className="flex gap-1">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded border border-border-primary bg-surface-secondary px-1.5 py-1 text-[10px] font-bold text-content-primary focus:border-tilli focus:outline-none"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Request name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
          className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1 text-xs text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
        />
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          placeholder="https://api.example.com/endpoint"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1 text-xs text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          className="rounded bg-tilli px-2 py-1 text-xs text-white hover:bg-tilli-light"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Collection Node (reusable for inside folders and standalone) ──────
function CollectionNode({
  col,
  depth,
  expanded,
  activeRequestId,
  addingRequest,
  onToggle,
  onAddRequest,
  onCancelAddRequest,
  onSubmitAddRequest,
  onDelete,
  onExport,
  onLoadRequest,
  onRemoveFromCollection,
  canWrite = true,
}: {
  col: CollectionWithRequests;
  depth: number;
  expanded: boolean;
  activeRequestId: string | null;
  addingRequest: boolean;
  onToggle: () => void;
  onAddRequest: () => void;
  onCancelAddRequest: () => void;
  onSubmitAddRequest: (name: string, method: string, url: string) => void;
  onDelete: () => void;
  onExport: (format: "postman" | "shell") => void;
  onLoadRequest: (req: SavedRequest) => void;
  onRemoveFromCollection: (collectionId: string, requestId: string) => void;
  canWrite?: boolean;
}) {
  const ml = depth * 12;
  return (
    <div style={{ marginLeft: ml }}>
      <div className="group/col flex items-center rounded transition-colors hover:bg-surface-secondary">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-xs text-content-secondary">
          <span className="shrink-0 text-content-muted">
            {expanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
          </span>
          <FolderIcon size={12} className="shrink-0 text-tilli/70" />
          <span className="truncate">{col.name}</span>
          <span className="ml-auto shrink-0 text-[10px] text-content-dim">{col.requests.length}</span>
        </button>
        {canWrite && (
          <button onClick={onAddRequest} title="Add request" className="shrink-0 px-1 py-1 text-content-dim opacity-0 transition-all hover:text-tilli-light group-hover/col:opacity-100">
            <PlusIcon size={12} />
          </button>
        )}
        <button onClick={() => onExport("postman")} title="Export as Postman JSON" className="shrink-0 px-1 py-1 text-content-dim opacity-0 transition-all hover:text-tilli-light group-hover/col:opacity-100">
          <DownloadIcon size={12} />
        </button>
        {canWrite && (
          <button onClick={onDelete} title="Delete collection" className="shrink-0 pr-2 py-1 text-content-dim opacity-0 transition-all hover:text-red-400 group-hover/col:opacity-100">
            <TrashIcon size={12} />
          </button>
        )}
      </div>
      {expanded && (
        <div className="ml-3">
          {addingRequest && (
            <RequestInput onSubmit={onSubmitAddRequest} onCancel={onCancelAddRequest} />
          )}
          {col.requests.length === 0 && !addingRequest ? (
            <p className="px-2 py-1 text-[10px] text-content-dim">No requests</p>
          ) : (
            col.requests.map((cr) => (
              <div
                key={cr.id}
                className={`group flex items-center rounded transition-colors ${
                  activeRequestId === cr.request.id
                    ? "bg-surface-secondary text-tilli-light"
                    : "text-content-tertiary hover:bg-surface-tertiary hover:text-content-primary"
                }`}
              >
                <button onClick={() => onLoadRequest(cr.request)} className="flex min-w-0 flex-1 items-center truncate px-2 py-1 text-left text-xs">
                  <MethodBadge curl={cr.request.curl} />
                  <span className="truncate">{cr.request.name}</span>
                </button>
                {canWrite && (
                  <button
                    onClick={() => onRemoveFromCollection(col.id, cr.request.id)}
                    title="Remove from collection (request is kept under Requests)"
                    className="hidden shrink-0 items-center pr-2 text-content-dim transition-colors hover:text-orange-400 group-hover:flex"
                  >
                    <UnlinkIcon size={10} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Sidebar ──────────────────────────────────────────────────────
export default function Sidebar({
  requests,
  folders,
  collections,
  activeRequestId,
  onLoadRequest,
  onSaveRequest,
  onDeleteRequest,
  onDeleteFolder,
  onDeleteCollection,
  onRemoveFromCollection,
  onImportPostman,
  importing,
  onNewRequest,
  loading,
  savePromptOpen,
  onSavePromptClose,
  user,
  onLogout,
  onOpenEnvironment,
  onCollectionsChange,
  getCurrentCurl,
  canWrite = true,
  workspace,
  teams = [],
  onSwitchPersonal,
  onSwitchTeam,
  onManageTeams,
  onViewActivity,
  teamHeaders = {},
  onShareRequest,
}: {
  requests: SavedRequest[];
  folders: Folder[];
  collections: CollectionWithRequests[]; // ungrouped (no folder)
  activeRequestId: string | null;
  onLoadRequest: (req: SavedRequest) => void;
  onSaveRequest: (name: string) => void;
  onDeleteRequest: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteCollection: (id: string) => void;
  onRemoveFromCollection: (collectionId: string, requestId: string) => void;
  onImportPostman: (json: unknown, folderId?: string | null) => void;
  importing: boolean;
  onNewRequest: () => void;
  loading: boolean;
  savePromptOpen: boolean;
  onSavePromptClose: () => void;
  user?: { id: string; email: string } | null;
  onLogout?: () => void;
  onOpenEnvironment?: () => void;
  onCollectionsChange?: () => void;
  getCurrentCurl?: () => string;
  canWrite?: boolean;
  workspace?: Workspace;
  teams?: TeamInfo[];
  onSwitchPersonal?: () => void;
  onSwitchTeam?: (teamId: string, teamName: string, role: TeamRole) => void;
  onManageTeams?: () => void;
  onViewActivity?: () => void;
  teamHeaders?: Record<string, string>;
  onShareRequest?: (requestId: string) => void;
}) {
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // tracks both folder and collection IDs
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newColFolderId, setNewColFolderId] = useState<string | null>(null); // which folder to add collection to
  const [addingToCollection, setAddingToCollection] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const importTargetFolderRef = useRef<string | null>(null); // folder to import into
  const saveRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (savePromptOpen && !showSave) setShowSave(true);
  }, [savePromptOpen, showSave]);

  // Dismiss save input on outside click
  useEffect(() => {
    if (!showSave) return;
    const handler = (e: MouseEvent) => {
      if (saveRowRef.current && !saveRowRef.current.contains(e.target as Node)) {
        setShowSave(false);
        setSaveName("");
        onSavePromptClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSave, onSavePromptClose]);

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;
    onSaveRequest(saveName.trim());
    setSaveName("");
    setShowSave(false);
    onSavePromptClose();
  }, [saveName, onSaveRequest, onSavePromptClose]);

  const handleCancelSave = useCallback(() => {
    setShowSave(false);
    setSaveName("");
    onSavePromptClose();
  }, [onSavePromptClose]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expand = (id: string) => {
    setExpanded((prev) => new Set(prev).add(id));
  };

  // ── API actions ──
  const handleCreateFolder = useCallback(async (name: string) => {
    try {
      const res = await fetch(api("/api/folders"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...teamHeaders },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setShowNewFolder(false);
        onCollectionsChange?.();
      }
    } catch {}
  }, [onCollectionsChange, teamHeaders]);

  const handleCreateCollection = useCallback(async (name: string, folderId: string | null) => {
    try {
      const res = await fetch(api("/api/collections"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...teamHeaders },
        body: JSON.stringify({ name, folderId }),
      });
      if (res.ok) {
        setShowNewCollection(false);
        setNewColFolderId(null);
        onCollectionsChange?.();
      }
    } catch {}
  }, [onCollectionsChange, teamHeaders]);

  const handleAddRequestToCollection = useCallback(async (collectionId: string, name: string, method: string, url: string) => {
    const curl = buildCurl({
      method: method as HttpMethod,
      url: url || "",
      headers: [{ key: "", value: "", enabled: true }],
      params: [{ key: "", value: "", enabled: true }],
      body: "",
      bodyType: "none",
      formData: [{ key: "", value: "", type: "text" as const, enabled: true }],
      auth: { type: "none" },
    });
    try {
      const res = await fetch(api(`/api/collections/${collectionId}/requests`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...teamHeaders },
        body: JSON.stringify({ name, curl }),
      });
      if (res.ok) {
        setAddingToCollection(null);
        onCollectionsChange?.();
      }
    } catch {}
  }, [onCollectionsChange, teamHeaders]);

  const handleImportFile = useCallback(async (file: File) => {
    const folderId = importTargetFolderRef.current;
    importTargetFolderRef.current = null;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      onImportPostman(json, folderId);
    } catch {
      onImportPostman(null);
    }
  }, [onImportPostman]);

  const handleImportFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImportFile(file);
    if (importFileRef.current) importFileRef.current.value = "";
  }, [handleImportFile]);

  const handleExportCollection = useCallback(async (collectionId: string, format: "postman" | "shell") => {
    try {
      const res = await fetch(api(`/api/collections/${collectionId}/export?format=${format}`), {
        headers: { ...teamHeaders },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      const nameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const filename = nameMatch?.[1] || `collection.${format === "postman" ? "json" : "sh"}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {}
  }, [teamHeaders]);

  // ── Render helpers ──
  const renderCollection = (col: CollectionWithRequests, depth: number) => (
    <CollectionNode
      key={col.id}
      col={col}
      depth={depth}
      expanded={expanded.has(col.id)}
      activeRequestId={activeRequestId}
      addingRequest={addingToCollection === col.id}
      onToggle={() => toggle(col.id)}
      onAddRequest={() => { expand(col.id); setAddingToCollection(col.id); }}
      onCancelAddRequest={() => setAddingToCollection(null)}
      onSubmitAddRequest={(name, method, url) => handleAddRequestToCollection(col.id, name, method, url)}
      onDelete={() => onDeleteCollection(col.id)}
      onExport={(format) => handleExportCollection(col.id, format)}
      onLoadRequest={onLoadRequest}
      onRemoveFromCollection={onRemoveFromCollection}
      canWrite={canWrite}
    />
  );

  const allEmpty = folders.length === 0 && collections.length === 0;

  return (
    <div data-testid="sidebar" className="flex h-full flex-col">
      <input ref={importFileRef} data-testid="import-file-input" type="file" accept=".json" onChange={handleImportFileChange} className="hidden" />

      {/* Header */}
      <div className="border-b border-border-secondary px-4 py-3">
        <div className="flex items-center gap-2.5">
          <img src={LOGO_SRC} alt="Tilli LLC" className="h-8 w-8 rounded-lg object-contain bg-white" />
          <div>
            <h1 className="text-base font-bold tracking-tight text-content-primary">Relay</h1>
            <p className="text-[10px] text-content-muted">curl-first API tool</p>
          </div>
        </div>
        {user && (
          <div className="mt-2 flex items-center justify-between">
            <span data-testid="sidebar-user-email" className="truncate text-[10px] text-content-muted" title={user.email}>{user.email}</span>
            {onLogout && (
              <button data-testid="sidebar-logout" onClick={onLogout} className="shrink-0 text-[10px] text-content-dim transition-colors hover:text-red-400">Logout</button>
            )}
          </div>
        )}
        {/* Workspace switcher */}
        {workspace && onSwitchPersonal && onSwitchTeam && onManageTeams && (
          <div className="mt-2">
            <WorkspaceSwitcher
              workspace={workspace}
              teams={teams}
              onSwitchPersonal={onSwitchPersonal}
              onSwitchTeam={onSwitchTeam}
              onManageTeams={onManageTeams}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2 border-b border-border-secondary p-3">
        {canWrite && (
          <>
            <button data-testid="new-request-button" onClick={onNewRequest} className="tilli-gradient flex w-full items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90">
              <PlusIcon size={12} /> New Request
            </button>
            {!showSave ? (
              <button data-testid="save-current-button" onClick={() => setShowSave(true)} className="w-full rounded bg-surface-secondary px-3 py-1.5 text-xs text-content-secondary transition-colors hover:bg-surface-secondary">Save Current</button>
            ) : (
              <div ref={saveRowRef} className="flex gap-1">
                <input data-testid="save-name-input" type="text" placeholder="Request name" value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancelSave(); }} autoFocus className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1 text-xs text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none" />
                <button data-testid="save-confirm-button" onClick={handleSave} className="rounded bg-tilli px-2 py-1 text-xs text-white hover:bg-tilli-light">Save</button>
              </div>
            )}
          </>
        )}
        {onOpenEnvironment && (
          <button data-testid="env-vars-button" onClick={onOpenEnvironment} className="flex w-full items-center justify-center gap-1.5 rounded bg-surface-secondary px-3 py-1.5 text-xs text-content-secondary transition-colors hover:bg-surface-secondary">
            <KeyIcon size={12} /> Environment Variables
          </button>
        )}
        {/* Team-mode buttons */}
        {workspace?.type === "team" && onViewActivity && (
          <button onClick={onViewActivity} className="flex w-full items-center justify-center gap-1.5 rounded bg-surface-secondary px-3 py-1.5 text-xs text-content-secondary transition-colors hover:bg-surface-secondary">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Activity Log
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div data-testid="sidebar-loading" className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-secondary" />
            <div className="h-6 w-full animate-pulse rounded bg-surface-secondary" />
            <div className="h-6 w-full animate-pulse rounded bg-surface-secondary" />
          </div>
        ) : (
          <>
            {/* My Collections — header with + menu */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
                  {workspace?.type === "team" ? "Team Collections" : "My Collections"}
                </h2>
                {canWrite && (
                  <PlusMenu items={[
                    { label: "Create Folder", icon: <FolderIcon size={12} />, onClick: () => setShowNewFolder(true) },
                    { label: "Create Collection", icon: <FolderIcon size={12} />, onClick: () => { setShowNewCollection(true); setNewColFolderId(null); } },
                    { label: "Import Postman Collection", icon: <UploadIcon size={12} />, onClick: () => { if (!importing) importFileRef.current?.click(); } },
                  ]} />
                )}
              </div>

              {importing && (
                <div className="mb-2 flex items-center gap-1.5 rounded bg-surface-secondary px-2 py-1.5 text-xs text-content-tertiary">
                  <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-border-primary border-t-content-secondary" />
                  Importing...
                </div>
              )}

              {/* New folder input */}
              {showNewFolder && (
                <InlineInput placeholder="Folder name" onSubmit={handleCreateFolder} onCancel={() => setShowNewFolder(false)} />
              )}

              {/* New standalone collection input */}
              {showNewCollection && newColFolderId === null && (
                <InlineInput placeholder="Collection name" onSubmit={(n) => handleCreateCollection(n, null)} onCancel={() => setShowNewCollection(false)} />
              )}

              {allEmpty && !showNewFolder && !showNewCollection ? (
                <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                  <FolderIcon size={24} className="text-content-faint" />
                  <p className="text-[10px] text-content-dim">No folders or collections yet</p>
                </div>
              ) : (
                <>
                  {/* Folders */}
                  {folders.map((folder) => (
                    <div key={folder.id} className="mb-1">
                      <div className="group/folder flex items-center rounded transition-colors hover:bg-surface-secondary">
                        <button onClick={() => toggle(folder.id)} className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-xs text-content-secondary">
                          <span className="shrink-0 text-content-muted">
                            {expanded.has(folder.id) ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                          </span>
                          <FolderIcon size={12} className="shrink-0 text-yellow-500/70" />
                          <span className="truncate font-medium">{folder.name}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-content-dim">{folder.collections.length}</span>
                        </button>
                        {canWrite && (
                          <span className="shrink-0 opacity-0 transition-all group-hover/folder:opacity-100">
                            <PlusMenu items={[
                              { label: "Create Collection", icon: <FolderIcon size={12} />, onClick: () => { expand(folder.id); setNewColFolderId(folder.id); setShowNewCollection(true); } },
                              { label: "Import Collection", icon: <UploadIcon size={12} />, onClick: () => { if (!importing) { importTargetFolderRef.current = folder.id; importFileRef.current?.click(); } } },
                            ]} />
                          </span>
                        )}
                        {canWrite && (
                          <button
                            onClick={() => onDeleteFolder(folder.id)}
                            title="Delete folder"
                            className="shrink-0 pr-2 py-1 text-content-dim opacity-0 transition-all hover:text-red-400 group-hover/folder:opacity-100"
                          >
                            <TrashIcon size={12} />
                          </button>
                        )}
                      </div>
                      {expanded.has(folder.id) && (
                        <div className="ml-3">
                          {/* New collection inside folder input */}
                          {showNewCollection && newColFolderId === folder.id && (
                            <InlineInput
                              placeholder="Collection name"
                              onSubmit={(n) => handleCreateCollection(n, folder.id)}
                              onCancel={() => { setShowNewCollection(false); setNewColFolderId(null); }}
                            />
                          )}
                          {folder.collections.length === 0 && !(showNewCollection && newColFolderId === folder.id) ? (
                            <p className="px-2 py-1 text-[10px] text-content-dim">No collections</p>
                          ) : (
                            folder.collections.map((col) => renderCollection(col, 0))
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Ungrouped collections (no folder) */}
                  {collections.map((col) => renderCollection(col, 0))}
                </>
              )}
            </div>

            {/* Saved Requests */}
            <div>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">Requests</h2>
              {requests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <InboxIcon size={28} className="text-content-faint" />
                  <p className="text-xs text-content-muted">No saved requests</p>
                  <p className="text-[10px] text-content-dim">Use Ctrl+S to save the current request</p>
                </div>
              ) : (
                requests.map((req) => (
                  <div
                    key={req.id}
                    data-testid={`request-item-${req.id}`}
                    className={`group flex items-center rounded px-2 py-1 transition-colors ${
                      activeRequestId === req.id ? "bg-surface-secondary text-tilli-light" : "text-content-tertiary hover:bg-surface-tertiary hover:text-content-primary"
                    }`}
                  >
                    <button data-testid={`request-load-${req.id}`} onClick={() => onLoadRequest(req)} className="flex min-w-0 flex-1 items-center truncate text-left text-xs">
                      <MethodBadge curl={req.curl} />
                      <span className="truncate">{req.name}</span>
                    </button>
                    {onShareRequest && (
                      <button data-testid={`request-share-${req.id}`} onClick={() => onShareRequest(req.id)} title="Share request" className="hidden shrink-0 items-center px-0.5 text-content-dim transition-colors hover:text-tilli-light group-hover:flex">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                    )}
                    {canWrite && (
                      <button data-testid={`request-delete-${req.id}`} onClick={() => onDeleteRequest(req.id)} title="Delete permanently" className="hidden shrink-0 items-center text-content-dim transition-colors hover:text-red-400 group-hover:flex">
                        <TrashIcon size={12} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Keyboard shortcuts */}
            <div className="mt-6 space-y-0.5 border-t border-border-secondary pt-3">
              <p className="text-[10px] text-content-dim">Ctrl+Enter &mdash; Send</p>
              <p className="text-[10px] text-content-dim">Ctrl+S &mdash; Save</p>
              <p className="text-[10px] text-content-dim">Ctrl+Shift+L &mdash; Focus URL</p>
              <p className="text-[10px] text-content-dim">Ctrl+K &mdash; Search</p>
              <p className="text-[10px] text-content-dim">Ctrl+Shift+E &mdash; Environments</p>
              <p className="text-[10px] text-content-dim">Ctrl+\ &mdash; Toggle Sidebar</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
