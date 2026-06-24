"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronRightIcon, ChevronDownIcon, TrashIcon, FolderIcon, InboxIcon, PlusIcon, KeyIcon, UploadIcon } from "@/components/Icons";
import { buildCurl } from "@/lib/curl/builder";
import { LOGO_SRC } from "@/lib/logo";
import { HttpMethod } from "@/lib/types";
import { api, authFetch } from "@/lib/apiBase";
import WorkspaceSwitcher, { type TeamInfo } from "@/components/WorkspaceSwitcher/WorkspaceSwitcher";
import type { Workspace, TeamRole } from "@/hooks/useWorkspace";
import { useTheme } from "@/hooks/useTheme";
import type { SavedRequest, CollectionWithRequests, Folder } from "@/lib/workspaceTypes";
import { MethodBadge } from "@/components/Sidebar/MethodBadge";
import { PlusMenu } from "@/components/Sidebar/PlusMenu";
import { InlineInput } from "@/components/Sidebar/InlineInput";
import { CollectionNode } from "@/components/Sidebar/CollectionNode";

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
      const res = await authFetch(api("/api/folders"), {
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
      const res = await authFetch(api("/api/collections"), {
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
      const res = await authFetch(api(`/api/collections/${collectionId}/requests`), {
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
      const res = await authFetch(api(`/api/collections/${collectionId}/export?format=${format}`), {
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
            <span data-testid="sidebar-user-email" className="truncate text-[10px] text-content-primary font-medium" title={user.email}>{user.email}</span>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              {onLogout && (
                <button data-testid="sidebar-logout" onClick={onLogout} className="shrink-0 rounded px-2 py-0.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500 hover:text-white">Logout</button>
              )}
            </div>
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

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: "light" | "dark" | "system"; label: string; icon: React.ReactNode }[] = [
    {
      value: "light",
      label: "Light",
      icon: (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ),
    },
    {
      value: "dark",
      label: "Dark",
      icon: (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
    {
      value: "system",
      label: "System",
      icon: (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
  ];

  return (
    <div data-testid="theme-toggle" className="flex rounded bg-surface-secondary p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          data-testid={`theme-btn-${opt.value}`}
          title={opt.label}
          onClick={() => setTheme(opt.value)}
          className={`rounded p-1 transition-colors ${
            theme === opt.value
              ? "bg-tilli text-white"
              : "text-content-muted hover:text-content-secondary"
          }`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
