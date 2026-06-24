"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardIcon, CheckIcon } from "@/components/Icons";
import { useTheme } from "@/hooks/useTheme";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function CurlPanel({
  curlString,
  onCurlChange,
}: {
  curlString: string;
  onCurlChange: (curl: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { resolved } = useTheme();

  // Clear debounce on unmount (prevents stale updates on tab switch)
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(curlString);
    } catch {
      // Fallback for non-secure contexts (e.g. behind a proxy)
      const textarea = document.createElement("textarea");
      textarea.value = curlString;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [curlString]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onCurlChange(value || "");
      }, 300);
    },
    [onCurlChange]
  );

  return (
    <div data-testid="curl-panel" className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-content-tertiary">
          <span className="mr-1.5 text-green-500">$</span>curl
        </h2>
        <button
          data-testid="curl-copy-button"
          onClick={handleCopy}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
            copied
              ? "bg-status-success-bg text-status-success-text"
              : "bg-surface-secondary text-content-secondary hover:bg-surface-secondary"
          }`}
        >
          {copied ? <><CheckIcon size={12} /> Copied</> : <><ClipboardIcon size={12} /> Copy</>}
        </button>
      </div>
      <div data-testid="curl-editor" className="flex-1 overflow-hidden rounded border border-border-primary">
        <span data-testid="curl-text" className="sr-only">{curlString}</span>
        <Editor
          height="100%"
          defaultLanguage="shell"
          value={curlString}
          onChange={handleEditorChange}
          theme={resolved === "light" ? "light" : "vs-dark"}
          options={{
            minimap: { enabled: false },
            wordWrap: "on",
            lineNumbers: "off",
            scrollBeyondLastLine: false,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            scrollbar: {
              vertical: "auto",
              horizontal: "hidden",
              verticalScrollbarSize: 6,
            },
            glyphMargin: false,
            folding: false,
            contextmenu: false,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}
