"use client";

import { Header } from "@/lib/types";
import { XIcon, PlusIcon } from "@/components/Icons";

const INPUT_CLASS =
  "w-full rounded-none border-0 bg-transparent px-3 py-2 text-sm text-content-primary placeholder-content-dim outline-none focus:outline-none";

export default function ParamsEditor({
  params,
  onChange,
}: {
  params: Header[];
  onChange: (p: Header[]) => void;
}) {
  const updateParam = (idx: number, patch: Partial<Header>) => {
    const next = [...params];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeParam = (idx: number) => {
    const next = params.filter((_, i) => i !== idx);
    onChange(next.length ? next : [{ key: "", value: "", enabled: true }]);
  };

  const addParam = () => {
    onChange([...params, { key: "", value: "", enabled: true }]);
  };

  return (
    <div data-testid="params-editor">
      <p className="mb-2 text-xs text-content-muted">Query Params</p>
      {/* Table */}
      <div className="overflow-hidden rounded border border-border-primary">
        {/* Header row */}
        <div className="flex items-center border-b border-border-primary bg-surface-secondary/50 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
          <span className="flex w-10 shrink-0 items-center justify-center" />
          <span className="flex-1 border-l border-border-primary px-3 py-1.5">Key</span>
          <span className="flex-1 border-l border-border-primary px-3 py-1.5">Value</span>
          <span className="w-9 shrink-0 border-l border-border-primary" />
        </div>

        {/* Data rows */}
        {params.map((param, idx) => (
          <div
            key={idx}
            data-testid={`param-row-${idx}`}
            className={`group flex items-center border-b border-border-primary last:border-b-0 transition-colors hover:bg-surface-secondary/30 ${
              !param.enabled ? "opacity-50" : ""
            }`}
          >
            <span className="flex w-10 shrink-0 items-center justify-center">
              <input
                data-testid={`param-enabled-${idx}`}
                type="checkbox"
                checked={param.enabled}
                onChange={(e) => updateParam(idx, { enabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-tilli"
              />
            </span>
            <span className="flex-1 border-l border-border-primary">
              <input
                data-testid={`param-key-${idx}`}
                type="text"
                placeholder="Key"
                value={param.key}
                onChange={(e) => updateParam(idx, { key: e.target.value })}
                className={INPUT_CLASS}
              />
            </span>
            <span className="flex-1 border-l border-border-primary">
              <input
                data-testid={`param-value-${idx}`}
                type="text"
                placeholder="Value"
                value={param.value}
                onChange={(e) => updateParam(idx, { value: e.target.value })}
                className={INPUT_CLASS}
              />
            </span>
            <span className="flex w-9 shrink-0 items-center justify-center border-l border-border-primary">
              <button
                data-testid={`param-remove-${idx}`}
                onClick={() => removeParam(idx)}
                className="rounded p-1 text-content-dim opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
              >
                <XIcon size={12} />
              </button>
            </span>
          </div>
        ))}
      </div>

      <button
        data-testid="add-param"
        onClick={addParam}
        className="mt-2 flex items-center gap-1 text-xs text-content-muted transition-colors hover:text-tilli-light"
      >
        <PlusIcon size={12} /> Add Parameter
      </button>
    </div>
  );
}
