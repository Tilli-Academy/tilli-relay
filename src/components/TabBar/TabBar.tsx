"use client";

import { XIcon, PlusIcon } from "@/components/Icons";
import { Tab } from "@/hooks/useTabManager";

const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-400",
  POST: "text-yellow-400",
  PUT: "text-blue-400",
  DELETE: "text-red-400",
  PATCH: "text-purple-400",
};

export default function TabBar({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onNew,
}: {
  tabs: Tab[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div data-testid="tab-bar" className="flex items-center border-b border-border-secondary bg-surface-primary/50">
      <div className="flex flex-1 items-center overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => onSwitch(tab.id)}
              className={`group flex cursor-pointer items-center gap-1.5 border-r border-border-secondary px-3 py-1.5 text-xs transition-colors select-none ${
                isActive
                  ? "bg-surface-secondary text-content-primary"
                  : "text-content-muted hover:bg-surface-tertiary hover:text-content-secondary"
              }`}
            >
              <span
                className={`shrink-0 text-[9px] font-bold ${METHOD_COLORS[tab.state.method] || "text-content-muted"}`}
              >
                {tab.state.method}
              </span>
              <span className="max-w-[140px] truncate">
                {tab.name}
              </span>
              {tabs.length > 1 && (
                <span
                  data-testid={`tab-close-${tab.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                  className={`ml-1 shrink-0 rounded p-0.5 transition-colors hover:bg-surface-secondary hover:text-content-primary ${
                    isActive ? "text-content-muted" : "text-content-faint group-hover:text-content-muted"
                  }`}
                >
                  <XIcon size={10} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <button
        data-testid="new-tab-button"
        onClick={onNew}
        className="shrink-0 border-l border-border-secondary px-2.5 py-1.5 text-content-muted transition-colors hover:bg-surface-tertiary hover:text-content-secondary"
        title="New tab (Ctrl+N)"
      >
        <PlusIcon size={14} />
      </button>
    </div>
  );
}
