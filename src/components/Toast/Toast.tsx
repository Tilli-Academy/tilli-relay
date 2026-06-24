"use client";

import { useEffect, useState } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error" | "info";
}

let nextId = 0;
const listeners: Set<(msg: ToastMessage) => void> = new Set();

export function showToast(text: string, type: ToastMessage["type"] = "info") {
  const msg: ToastMessage = { id: nextId++, text, type };
  listeners.forEach((fn) => fn(msg));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setToasts((prev) => [...prev, msg]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, 4000);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div data-testid="toast-container" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          data-testid={`toast-${t.id}`}
          data-toast-type={t.type}
          className={`animate-in slide-in-from-right rounded-lg px-4 py-2.5 text-sm shadow-lg ${
            t.type === "success"
              ? "bg-toast-success-bg text-toast-success-text"
              : t.type === "error"
                ? "bg-toast-error-bg text-toast-error-text"
                : "bg-toast-info-bg text-toast-info-text"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
