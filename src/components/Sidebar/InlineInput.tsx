"use client";

import { useState, useEffect, useRef } from "react";

export interface InlineInputProps {
  placeholder: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InlineInput({ placeholder, onSubmit, onCancel }: InlineInputProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  return (
    <div ref={ref} className="my-1 flex gap-1">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
        className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1 text-xs text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
      />
      <button
        onClick={() => value.trim() && onSubmit(value.trim())}
        className="rounded bg-tilli px-2 py-1 text-xs text-white hover:bg-tilli-light"
      >
        Add
      </button>
    </div>
  );
}
