"use client";

import { PlusIcon, TrashIcon } from "@/components/Icons";

interface Environment {
  id: string;
  name: string;
  isActive: boolean;
}

interface EnvironmentTabsProps {
  environments: Environment[];
  selectedEnvId: string | null;
  onSelectEnv: (envId: string) => void;
  onSetActive: (envId: string) => void;
  onDeleteEnv: (envId: string, envName: string) => void;
  addingEnv: boolean;
  onSetAddingEnv: (adding: boolean) => void;
  newEnvName: string;
  onNewEnvNameChange: (name: string) => void;
  onCreateEnv: () => void;
  creatingEnv: boolean;
}

export default function EnvironmentTabs({
  environments,
  selectedEnvId,
  onSelectEnv,
  onSetActive,
  onDeleteEnv,
  addingEnv,
  onSetAddingEnv,
  newEnvName,
  onNewEnvNameChange,
  onCreateEnv,
  creatingEnv,
}: EnvironmentTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border-secondary px-4 py-2">
      <div className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
        {environments.map((env) => (
          <div key={env.id} className="group flex items-center">
            <button
              data-testid={`env-tab-${env.id}`}
              onClick={() => onSelectEnv(env.id)}
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
                  onClick={() => onSetActive(env.id)}
                  title="Set as active"
                  className="rounded p-0.5 text-[10px] text-content-muted hover:text-green-400"
                >
                  ●
                </button>
              )}
              <button
                onClick={() => onDeleteEnv(env.id, env.name)}
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
            onChange={(e) => onNewEnvNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreateEnv();
              if (e.key === "Escape") {
                onSetAddingEnv(false);
                onNewEnvNameChange("");
              }
            }}
            placeholder="Name"
            autoFocus
            className="w-28 rounded border border-border-primary bg-surface-secondary px-2 py-0.5 text-xs text-content-primary placeholder-content-muted focus:border-tilli focus:outline-none"
          />
          <button
            data-testid="env-new-confirm"
            onClick={onCreateEnv}
            disabled={creatingEnv || !newEnvName.trim()}
            className="rounded bg-tilli px-2 py-0.5 text-xs text-white hover:bg-tilli-light disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          data-testid="env-new-button"
          onClick={() => onSetAddingEnv(true)}
          className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-content-muted transition-colors hover:bg-surface-secondary hover:text-content-secondary"
        >
          <PlusIcon size={12} /> New
        </button>
      )}
    </div>
  );
}
