"use client";

import { useEffect, useRef } from "react";

interface ShortcutHandlers {
  onSend: () => void;
  onSave: () => void;
  onFocusUrl?: () => void;
  onSearch?: () => void;
  onToggleEnv?: () => void;
  onToggleSidebar?: () => void;
}

/**
 * Global keyboard shortcuts:
 *   Ctrl+Enter       — Send request
 *   Ctrl+S           — Save current request
 *   Ctrl+Shift+L     — Focus URL input
 *   Ctrl+K           — Open search
 *   Ctrl+Shift+E     — Toggle environment panel
 *   Ctrl+\           — Toggle sidebar
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === "Enter") {
        e.preventDefault();
        ref.current.onSend();
      } else if (e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        ref.current.onSave();
      } else if (e.code === "KeyL" && e.shiftKey) {
        e.preventDefault();
        ref.current.onFocusUrl?.();
      } else if (e.key === "k") {
        e.preventDefault();
        ref.current.onSearch?.();
      } else if (e.code === "KeyE" && e.shiftKey) {
        e.preventDefault();
        ref.current.onToggleEnv?.();
      } else if (e.key === "\\") {
        e.preventDefault();
        ref.current.onToggleSidebar?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);
}
