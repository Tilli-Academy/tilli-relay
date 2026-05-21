"use client";

import { useCallback, useRef, useState } from "react";
import { UploadIcon } from "@/components/Icons";

export default function ImportButton({
  onImport,
  importing,
}: {
  onImport: (json: unknown) => void;
  importing: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        onImport(json);
      } catch {
        onImport(null); // signal parse failure to parent
      }
    },
    [onImport]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (fileRef.current) fileRef.current.value = "";
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => !importing && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        disabled={importing}
        className={`w-full rounded border border-dashed px-3 py-2 text-xs transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-950/30 text-blue-400"
            : importing
              ? "border-border-primary text-content-dim"
              : "border-border-primary text-content-tertiary hover:border-border-primary hover:text-content-secondary"
        }`}
      >
        {importing ? (
          <span className="flex items-center justify-center gap-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-border-primary border-t-content-secondary" />
            Importing...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-1.5">
            <UploadIcon size={12} />
            Import Postman Collection
          </span>
        )}
      </button>
    </>
  );
}
