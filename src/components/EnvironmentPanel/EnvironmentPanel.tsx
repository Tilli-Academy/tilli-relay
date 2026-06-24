"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { EnvironmentVariable } from "@/lib/types";
import { XIcon } from "@/components/Icons";
import { showToast } from "@/components/Toast/Toast";
import { api, authFetch } from "@/lib/apiBase";
import EnvironmentTabs from "./EnvironmentTabs";
import VariableEditor from "./VariableEditor";

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
      const res = await authFetch(api("/api/environments"), {
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
        const res = await authFetch(api(`/api/environments/${envId}`), { method: "DELETE", headers: { ...teamHeaders } });
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
        const res = await authFetch(api(`/api/environments/${envId}`), {
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
      const res = await authFetch(api("/api/variables"), {
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
        const res = await authFetch(api(`/api/variables/${id}`), { method: "DELETE", headers: { ...teamHeaders } });
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
        <EnvironmentTabs
          environments={environments}
          selectedEnvId={selectedEnvId}
          onSelectEnv={handleSelectEnv}
          onSetActive={handleSetActive}
          onDeleteEnv={handleDeleteEnv}
          addingEnv={addingEnv}
          onSetAddingEnv={setAddingEnv}
          newEnvName={newEnvName}
          onNewEnvNameChange={setNewEnvName}
          onCreateEnv={handleCreateEnv}
          creatingEnv={creatingEnv}
        />

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

              <VariableEditor
                variables={variables}
                newVar={newVar}
                onNewVarChange={setNewVar}
                onCreateVar={handleCreateVar}
                onDeleteVar={handleDeleteVar}
                saving={saving}
                deletingId={deletingId}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
