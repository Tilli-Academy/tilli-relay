"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { EnvironmentVariable } from "@/lib/types";
import { XIcon, PlusIcon, TrashIcon, LockIcon } from "@/components/Icons";
import { showToast } from "@/components/Toast/Toast";
import { api } from "@/lib/apiBase";

interface Environment {
  id: string;
  name: string;
  isActive: boolean;
}

interface EnvironmentPanelProps {
  open: boolean;
  onClose: () => void;
  environments: Environment[];
  variables: EnvironmentVariable[];
  onEnvironmentsChange: () => void;
  onVariablesChange: (environmentId?: string) => void;
  activeEnvironmentId: string | null;
  teamHeaders?: Record<string, string>;
}

interface EditingVar {
  key: string;
  value: string;
  isSecret: boolean;
}

export default function EnvironmentPanel({
  open,
  onClose,
  environments,
  variables,
  onEnvironmentsChange,
  onVariablesChange,
  activeEnvironmentId,
  teamHeaders = {},
}: EnvironmentPanelProps) {
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(activeEnvironmentId);
  const [newVar, setNewVar] = useState<EditingVar>({ key: "", value: "", isSecret: false });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newEnvName, setNewEnvName] = useState("");
  const [addingEnv, setAddingEnv] = useState(false);
  const [creatingEnv, setCreatingEnv] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sync selected environment when activeEnvironmentId changes
  useEffect(() => {
    if (activeEnvironmentId) {
      setSelectedEnvId(activeEnvironmentId);
    }
  }, [activeEnvironmentId]);

  // When panel opens and there's an active environment, load its variables
  useEffect(() => {
    if (open && selectedEnvId) {
      onVariablesChange(selectedEnvId);
    }
  }, [open, selectedEnvId]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Close when clicking backdrop
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  const handleCreateEnv = useCallback(async () => {
    if (!newEnvName.trim()) return;
    setCreatingEnv(true);
    try {
      const res = await fetch(api("/api/environments"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...teamHeaders },
        body: JSON.stringify({ name: newEnvName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setNewEnvName("");
        setAddingEnv(false);
        onEnvironmentsChange();
        setSelectedEnvId(created.id);
        showToast(`Environment "${created.name}" created`, "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to create environment", "error");
      }
    } catch {
      showToast("Failed to create environment", "error");
    } finally {
      setCreatingEnv(false);
    }
  }, [newEnvName, onEnvironmentsChange, teamHeaders]);

  const handleDeleteEnv = useCallback(
    async (envId: string, envName: string) => {
      try {
        const res = await fetch(api(`/api/environments/${envId}`), { method: "DELETE", headers: { ...teamHeaders } });
        if (res.ok) {
          onEnvironmentsChange();
          if (selectedEnvId === envId) {
            const remaining = environments.filter((e) => e.id !== envId);
            setSelectedEnvId(remaining[0]?.id || null);
          }
          showToast(`Environment "${envName}" deleted`, "info");
        } else {
          showToast("Failed to delete environment", "error");
        }
      } catch {
        showToast("Failed to delete environment", "error");
      }
    },
    [environments, selectedEnvId, onEnvironmentsChange, teamHeaders]
  );

  const handleSetActive = useCallback(
    async (envId: string) => {
      try {
        const res = await fetch(api(`/api/environments/${envId}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...teamHeaders },
          body: JSON.stringify({ isActive: true }),
        });
        if (res.ok) {
          onEnvironmentsChange();
          showToast("Environment activated", "success");
        }
      } catch {
        showToast("Failed to activate environment", "error");
      }
    },
    [onEnvironmentsChange, teamHeaders]
  );

  const handleCreateVar = useCallback(async () => {
    if (!newVar.key.trim() || !selectedEnvId) return;
    setSaving(true);
    try {
      const res = await fetch(api("/api/variables"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...teamHeaders },
        body: JSON.stringify({ ...newVar, environmentId: selectedEnvId }),
      });
      if (res.ok) {
        setNewVar({ key: "", value: "", isSecret: false });
        onVariablesChange(selectedEnvId);
        showToast(`Variable "${newVar.key}" created`, "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to create variable", "error");
      }
    } catch {
      showToast("Failed to create variable", "error");
    } finally {
      setSaving(false);
    }
  }, [newVar, selectedEnvId, onVariablesChange, teamHeaders]);

  const handleDeleteVar = useCallback(
    async (id: string, key: string) => {
      setDeletingId(id);
      try {
        const res = await fetch(api(`/api/variables/${id}`), { method: "DELETE", headers: { ...teamHeaders } });
        if (res.ok) {
          onVariablesChange(selectedEnvId || undefined);
          showToast(`Variable "${key}" deleted`, "info");
        } else {
          showToast("Failed to delete variable", "error");
        }
      } catch {
        showToast("Failed to delete variable", "error");
      } finally {
        setDeletingId(null);
      }
    },
    [selectedEnvId, onVariablesChange, teamHeaders]
  );

  const handleSelectEnv = useCallback(
    (envId: string) => {
      setSelectedEnvId(envId);
      onVariablesChange(envId);
    },
    [onVariablesChange]
  );

  if (!open) return null;

  const selectedEnv = environments.find((e) => e.id === selectedEnvId);

  return (
    <div
      data-testid="env-panel-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-bg)]"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        data-testid="env-panel"
        className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg border border-border-primary bg-surface-primary shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-secondary px-4 py-3">
          <h2 className="text-sm font-semibold text-content-primary">Environment Variables</h2>
          <button
            data-testid="env-panel-close"
            onClick={onClose}
            className="rounded p-1 text-content-muted transition-colors hover:bg-surface-secondary hover:text-content-secondary"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Environment Tabs */}
        <div className="flex items-center gap-1 border-b border-border-secondary px-4 py-2">
          <div className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
            {environments.map((env) => (
              <div key={env.id} className="group flex items-center">
                <button
                  data-testid={`env-tab-${env.id}`}
                  onClick={() => handleSelectEnv(env.id)}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
                    selectedEnvId === env.id
                      ? "bg-surface-secondary text-content-primary"
                      : "text-content-tertiary hover:bg-surface-secondary hover:text-content-secondary"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      env.isActive ? "bg-green-400" : "bg-surface-secondary"
                    }`}
                  />
                  {env.name}
                </button>
                {/* Actions on hover */}
                <span className="ml-0.5 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                  {!env.isActive && (
                    <button
                      onClick={() => handleSetActive(env.id)}
                      title="Set as active"
                      className="rounded p-0.5 text-[10px] text-content-muted hover:text-green-400"
                    >
                      ●
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteEnv(env.id, env.name)}
                    title="Delete environment"
                    className="rounded p-0.5 text-content-dim hover:text-red-400"
                  >
                    <TrashIcon size={10} />
                  </button>
                </span>
              </div>
            ))}
          </div>
          {/* Add environment */}
          {addingEnv ? (
            <div className="flex items-center gap-1">
              <input
                data-testid="env-new-name"
                type="text"
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateEnv();
                  if (e.key === "Escape") {
                    setAddingEnv(false);
                    setNewEnvName("");
                  }
                }}
                placeholder="Name"
                autoFocus
                className="w-28 rounded border border-border-primary bg-surface-secondary px-2 py-0.5 text-xs text-content-primary placeholder-content-muted focus:border-tilli focus:outline-none"
              />
              <button
                data-testid="env-new-confirm"
                onClick={handleCreateEnv}
                disabled={creatingEnv || !newEnvName.trim()}
                className="rounded bg-tilli px-2 py-0.5 text-xs text-white hover:bg-tilli-light disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              data-testid="env-new-button"
              onClick={() => setAddingEnv(true)}
              className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-content-muted transition-colors hover:bg-surface-secondary hover:text-content-secondary"
            >
              <PlusIcon size={12} /> New
            </button>
          )}
        </div>

        {/* Content */}
        <div className="max-h-[55vh] overflow-y-auto p-4">
          {!selectedEnvId || environments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <p className="text-xs text-content-muted">No environment selected</p>
              <p className="text-[10px] text-content-dim">
                Create an environment to start adding variables
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-[11px] text-content-muted">
                Use{" "}
                <code className="rounded bg-surface-secondary px-1 py-0.5 text-content-tertiary">
                  {"{{VAR_NAME}}"}
                </code>{" "}
                in URL, headers, or body. Variables from the{" "}
                <span className="font-semibold text-content-secondary">{selectedEnv?.name}</span>{" "}
                environment{selectedEnv?.isActive ? " (active)" : ""} are shown below.
                {!selectedEnv?.isActive && (
                  <button
                    onClick={() => selectedEnvId && handleSetActive(selectedEnvId)}
                    className="ml-1 text-tilli-light underline hover:text-tilli"
                  >
                    Set as active
                  </button>
                )}
              </p>

              {/* Existing variables */}
              {variables.length > 0 && (
                <div className="mb-4 space-y-1.5">
                  <div className="flex items-center gap-2 border-b border-border-secondary px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
                    <span className="w-36">Key</span>
                    <span className="flex-1">Value</span>
                    <span className="w-6" />
                  </div>

                  {variables.map((v) => (
                    <div key={v.id} data-testid={`env-var-${v.id}`} className="flex items-center gap-2">
                      <div className="flex w-36 items-center gap-1">
                        {v.isSecret && (
                          <LockIcon size={11} className="shrink-0 text-yellow-500" />
                        )}
                        <span
                          className="truncate font-mono text-xs text-content-primary"
                          title={v.key}
                        >
                          {v.key}
                        </span>
                      </div>
                      <span className="flex-1 truncate font-mono text-xs text-content-tertiary">
                        {v.isSecret ? "••••••••" : v.value || "(empty)"}
                      </span>
                      <button
                        data-testid={`env-var-delete-${v.id}`}
                        onClick={() => handleDeleteVar(v.id, v.key)}
                        disabled={deletingId === v.id}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-content-dim transition-colors hover:bg-surface-secondary hover:text-red-400 disabled:opacity-50"
                      >
                        <TrashIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {variables.length === 0 && (
                <p className="mb-4 text-center text-xs text-content-dim">
                  No variables in this environment
                </p>
              )}

              {/* Add new variable */}
              <div className="rounded border border-border-secondary p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
                  Add Variable
                </p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      data-testid="env-var-new-key"
                      type="text"
                      placeholder="KEY_NAME"
                      value={newVar.key}
                      onChange={(e) => setNewVar((p) => ({ ...p, key: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateVar();
                      }}
                      className="w-36 rounded border border-border-primary bg-surface-secondary px-2 py-1.5 font-mono text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
                    />
                    <input
                      data-testid="env-var-new-value"
                      type={newVar.isSecret ? "password" : "text"}
                      placeholder="value"
                      value={newVar.value}
                      onChange={(e) => setNewVar((p) => ({ ...p, value: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateVar();
                      }}
                      className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1.5 font-mono text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs text-content-tertiary">
                      <input
                        data-testid="env-var-new-secret"
                        type="checkbox"
                        checked={newVar.isSecret}
                        onChange={(e) =>
                          setNewVar((p) => ({ ...p, isSecret: e.target.checked }))
                        }
                        className="h-3.5 w-3.5 accent-yellow-500"
                      />
                      <LockIcon size={11} className="text-yellow-500" />
                      Secret (masked after save)
                    </label>
                    <button
                      data-testid="env-var-new-add"
                      onClick={handleCreateVar}
                      disabled={saving || !newVar.key.trim()}
                      className="flex items-center gap-1 rounded bg-tilli px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-tilli-light disabled:opacity-50"
                    >
                      <PlusIcon size={12} /> {saving ? "Saving..." : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
