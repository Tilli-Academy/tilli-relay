"use client";

import { useState, useEffect, useRef } from "react";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

export interface RequestInputProps {
  onSubmit: (name: string, method: string, url: string) => void;
  onCancel: () => void;
}

export function RequestInput({ onSubmit, onCancel }: RequestInputProps) {
  const [method, setMethod] = useState<string>("GET");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), method, url.trim());
  };

  return (
    <div ref={ref} className="my-1 space-y-1 rounded border border-border-primary bg-surface-tertiary p-2">
      <div className="flex gap-1">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded border border-border-primary bg-surface-secondary px-1.5 py-1 text-[10px] font-bold text-content-primary focus:border-tilli focus:outline-none"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Request name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
          className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1 text-xs text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
        />
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          placeholder="https://api.example.com/endpoint"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1 text-xs text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          className="rounded bg-tilli px-2 py-1 text-xs text-white hover:bg-tilli-light"
        >
          Add
        </button>
      </div>
    </div>
  );
}
