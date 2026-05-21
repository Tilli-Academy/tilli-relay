"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDownIcon } from "@/components/Icons";

export interface Environment {
  id: string;
  name: string;
  isActive: boolean;
}

export default function EnvironmentSwitcher({
  environments,
  onSwitch,
  onClear,
  onManage,
}: {
  environments: Environment[];
  onSwitch: (id: string) => void;
  onClear?: () => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = environments.find((e) => e.isActive);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSwitch = useCallback(
    (id: string) => {
      onSwitch(id);
      setOpen(false);
    },
    [onSwitch]
  );

  return (
    <div ref={ref} data-testid="env-switcher" className="relative">
      <button
        data-testid="env-switcher-button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 rounded border border-border-primary bg-surface-tertiary px-2.5 py-1 text-xs text-content-secondary transition-colors hover:border-border-primary hover:bg-surface-secondary"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${active ? "bg-green-400" : "bg-surface-secondary"}`}
        />
        <span className="max-w-[120px] truncate">
          {active?.name || "No Environment"}
        </span>
        <ChevronDownIcon
          size={12}
          className={`text-content-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div data-testid="env-switcher-dropdown" className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded border border-border-primary bg-surface-primary py-1 shadow-xl">
          {environments.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-content-muted">No environments</p>
          )}
          {environments.length > 0 && onClear && (
            <>
              <button
                data-testid="env-option-none"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-secondary ${
                  !active ? "text-content-primary" : "text-content-tertiary"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    !active ? "bg-green-400" : "bg-surface-secondary"
                  }`}
                />
                <span className="flex-1">No Environment</span>
                {!active && (
                  <span className="text-[10px] text-green-400">Active</span>
                )}
              </button>
              <div className="my-1 border-t border-border-secondary" />
            </>
          )}
          {environments.map((env) => (
            <button
              key={env.id}
              data-testid={`env-option-${env.id}`}
              onClick={() => handleSwitch(env.id)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-secondary ${
                env.isActive ? "text-content-primary" : "text-content-tertiary"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  env.isActive ? "bg-green-400" : "bg-surface-secondary"
                }`}
              />
              <span className="flex-1 truncate">{env.name}</span>
              {env.isActive && (
                <span className="text-[10px] text-green-400">Active</span>
              )}
            </button>
          ))}
          <div className="my-1 border-t border-border-secondary" />
          <button
            data-testid="env-manage-button"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-tilli-light transition-colors hover:bg-surface-secondary"
          >
            Manage Environments
          </button>
        </div>
      )}
    </div>
  );
}
