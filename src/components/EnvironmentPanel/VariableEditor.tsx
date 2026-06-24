"use client";

import { EnvironmentVariable } from "@/lib/types";
import { PlusIcon, TrashIcon, LockIcon } from "@/components/Icons";

interface EditingVar {
  key: string;
  value: string;
  isSecret: boolean;
}

interface VariableEditorProps {
  variables: EnvironmentVariable[];
  newVar: EditingVar;
  onNewVarChange: (updater: (prev: EditingVar) => EditingVar) => void;
  onCreateVar: () => void;
  onDeleteVar: (id: string, key: string) => void;
  saving: boolean;
  deletingId: string | null;
}

export default function VariableEditor({
  variables,
  newVar,
  onNewVarChange,
  onCreateVar,
  onDeleteVar,
  saving,
  deletingId,
}: VariableEditorProps) {
  return (
    <>
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
                onClick={() => onDeleteVar(v.id, v.key)}
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
              onChange={(e) => onNewVarChange((p) => ({ ...p, key: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreateVar();
              }}
              className="w-36 rounded border border-border-primary bg-surface-secondary px-2 py-1.5 font-mono text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
            />
            <input
              data-testid="env-var-new-value"
              type={newVar.isSecret ? "password" : "text"}
              placeholder="value"
              value={newVar.value}
              onChange={(e) => onNewVarChange((p) => ({ ...p, value: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreateVar();
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
                  onNewVarChange((p) => ({ ...p, isSecret: e.target.checked }))
                }
                className="h-3.5 w-3.5 accent-yellow-500"
              />
              <LockIcon size={11} className="text-yellow-500" />
              Secret (masked after save)
            </label>
            <button
              data-testid="env-var-new-add"
              onClick={onCreateVar}
              disabled={saving || !newVar.key.trim()}
              className="flex items-center gap-1 rounded bg-tilli px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-tilli-light disabled:opacity-50"
            >
              <PlusIcon size={12} /> {saving ? "Saving..." : "Add"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
