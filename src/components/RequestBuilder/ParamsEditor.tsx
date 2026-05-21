"use client";

import { Header } from "@/lib/types";
import { XIcon, PlusIcon } from "@/components/Icons";

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
    <div data-testid="params-editor" className="space-y-1.5">
      {/* Column labels */}
      <div className="flex items-center gap-2 border-b border-border-secondary px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
        <span className="w-5" />
        <span className="w-44">Key</span>
        <span className="flex-1">Value</span>
        <span className="w-6" />
      </div>

      {params.map((param, idx) => (
        <div key={idx} data-testid={`param-row-${idx}`} className="flex items-center gap-2">
          <input
            data-testid={`param-enabled-${idx}`}
            type="checkbox"
            checked={param.enabled}
            onChange={(e) => updateParam(idx, { enabled: e.target.checked })}
            className="h-3.5 w-3.5 accent-tilli"
          />
          <input
            data-testid={`param-key-${idx}`}
            type="text"
            placeholder="Key"
            value={param.key}
            onChange={(e) => updateParam(idx, { key: e.target.value })}
            className="w-44 rounded border border-border-primary bg-surface-secondary px-2 py-1.5 text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
          />
          <input
            data-testid={`param-value-${idx}`}
            type="text"
            placeholder="Value"
            value={param.value}
            onChange={(e) => updateParam(idx, { value: e.target.value })}
            className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1.5 text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
          />
          <button
            data-testid={`param-remove-${idx}`}
            onClick={() => removeParam(idx)}
            className="flex h-6 w-6 items-center justify-center rounded text-content-muted transition-colors hover:bg-surface-secondary hover:text-red-400"
          >
            <XIcon size={14} />
          </button>
        </div>
      ))}

      <button
        data-testid="add-param"
        onClick={addParam}
        className="mt-1 flex items-center gap-1 text-xs text-tilli-light transition-colors hover:text-tilli-light"
      >
        <PlusIcon size={12} /> Add Parameter
      </button>
    </div>
  );
}
