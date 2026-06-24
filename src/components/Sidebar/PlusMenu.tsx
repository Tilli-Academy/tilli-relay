"use client";

import { useState, useEffect, useRef } from "react";
import { PlusIcon } from "@/components/Icons";

export interface PlusMenuProps {
  items: { label: string; icon: React.ReactNode; onClick: () => void }[];
}

export function PlusMenu({ items }: PlusMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        title="Add"
        className="rounded p-0.5 text-content-muted transition-colors hover:bg-surface-secondary hover:text-content-secondary"
      >
        <PlusIcon size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-md border border-border-primary bg-surface-primary py-1 shadow-xl">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { setOpen(false); item.onClick(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-content-secondary transition-colors hover:bg-surface-secondary"
            >
              <span className="shrink-0 text-content-muted">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
