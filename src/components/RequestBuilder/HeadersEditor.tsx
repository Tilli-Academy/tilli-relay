"use client";

import { Header } from "@/lib/types";
import { XIcon, PlusIcon } from "@/components/Icons";

const INPUT_CLASS =
  "w-full rounded-none border-0 bg-transparent px-3 py-2 text-sm text-content-primary placeholder-content-dim outline-none focus:outline-none";

export default function HeadersEditor({
  headers,
  onChange,
}: {
  headers: Header[];
  onChange: (h: Header[]) => void;
}) {
  const updateHeader = (idx: number, patch: Partial<Header>) => {
    const next = [...headers];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeHeader = (idx: number) => {
    const next = headers.filter((_, i) => i !== idx);
    onChange(next.length ? next : [{ key: "", value: "", enabled: true }]);
  };

  const addHeader = () => {
    onChange([...headers, { key: "", value: "", enabled: true }]);
  };

  return (
    <div data-testid="headers-editor">
      <p className="mb-2 text-xs text-content-muted">Headers</p>
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
        {headers.map((header, idx) => (
          <div
            key={idx}
            data-testid={`header-row-${idx}`}
            className={`group flex items-center border-b border-border-primary last:border-b-0 transition-colors hover:bg-surface-secondary/30 ${
              !header.enabled ? "opacity-50" : ""
            }`}
          >
            <span className="flex w-10 shrink-0 items-center justify-center">
              <input
                data-testid={`header-enabled-${idx}`}
                type="checkbox"
                checked={header.enabled}
                onChange={(e) => updateHeader(idx, { enabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-tilli"
              />
            </span>
            <span className="flex-1 border-l border-border-primary">
              <input
                data-testid={`header-key-${idx}`}
                type="text"
                placeholder="Key"
                value={header.key}
                onChange={(e) => updateHeader(idx, { key: e.target.value })}
                className={INPUT_CLASS}
              />
            </span>
            <span className="flex-1 border-l border-border-primary">
              <input
                data-testid={`header-value-${idx}`}
                type="text"
                placeholder="Value"
                value={header.value}
                onChange={(e) => updateHeader(idx, { value: e.target.value })}
                className={INPUT_CLASS}
              />
            </span>
            <span className="flex w-9 shrink-0 items-center justify-center border-l border-border-primary">
              <button
                data-testid={`header-remove-${idx}`}
                onClick={() => removeHeader(idx)}
                className="rounded p-1 text-content-dim opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
              >
                <XIcon size={12} />
              </button>
            </span>
          </div>
        ))}
      </div>

      <button
        data-testid="add-header"
        onClick={addHeader}
        className="mt-2 flex items-center gap-1 text-xs text-content-muted transition-colors hover:text-tilli-light"
      >
        <PlusIcon size={12} /> Add Header
      </button>
    </div>
  );
}
