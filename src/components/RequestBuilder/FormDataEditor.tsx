"use client";

import { useState, useCallback } from "react";
import { FormDataField } from "@/lib/types";
import { XIcon, PlusIcon, UploadIcon } from "@/components/Icons";
import { showToast } from "@/components/Toast/Toast";
import { api, authFetch } from "@/lib/apiBase";

export default function FormDataEditor({
  fields,
  onChange,
}: {
  fields: FormDataField[];
  onChange: (f: FormDataField[]) => void;
}) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const updateField = (idx: number, patch: Partial<FormDataField>) => {
    const next = [...fields];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeField = (idx: number) => {
    const next = fields.filter((_, i) => i !== idx);
    onChange(next.length ? next : [{ key: "", value: "", type: "text", enabled: true }]);
  };

  const addField = () => {
    onChange([...fields, { key: "", value: "", type: "text", enabled: true }]);
  };

  const handleFileUpload = useCallback(
    async (idx: number, file: File) => {
      setUploadingIdx(idx);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await authFetch(api("/api/upload"), {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          const next = [...fields];
          next[idx] = {
            ...next[idx],
            value: data.filePath,
            fileName: data.fileName,
            fileId: data.fileId,
          };
          onChange(next);
        } else {
          const data = await res.json();
          showToast(data.error || "Upload failed", "error");
        }
      } catch {
        showToast("Failed to upload file", "error");
      } finally {
        setUploadingIdx(null);
      }
    },
    [fields, onChange]
  );

  return (
    <div className="space-y-1.5">
      {/* Column labels */}
      <div className="flex items-center gap-2 border-b border-border-secondary px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
        <span className="w-5" />
        <span className="w-32">Key</span>
        <span className="w-16">Type</span>
        <span className="flex-1">Value</span>
        <span className="w-6" />
      </div>

      {fields.map((field, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.enabled}
            onChange={(e) => updateField(idx, { enabled: e.target.checked })}
            className="h-3.5 w-3.5 accent-tilli"
          />
          <input
            type="text"
            placeholder="Key"
            value={field.key}
            onChange={(e) => updateField(idx, { key: e.target.value })}
            className="w-32 rounded border border-border-primary bg-surface-secondary px-2 py-1.5 text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
          />
          <select
            value={field.type}
            onChange={(e) => {
              const newType = e.target.value as "text" | "file";
              updateField(idx, { type: newType, value: "", fileName: undefined, fileId: undefined });
            }}
            className="w-16 rounded border border-border-primary bg-surface-secondary px-1 py-1.5 text-xs text-content-secondary focus:border-tilli focus:outline-none"
          >
            <option value="text">Text</option>
            <option value="file">File</option>
          </select>

          {field.type === "text" ? (
            <input
              type="text"
              placeholder="Value"
              value={field.value}
              onChange={(e) => updateField(idx, { value: e.target.value })}
              className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1.5 text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
            />
          ) : (
            <div className="flex flex-1 items-center gap-2">
              {uploadingIdx === idx ? (
                <span className="text-xs text-content-muted">Uploading...</span>
              ) : field.fileName ? (
                <span className="truncate text-xs text-content-secondary" title={field.fileName}>
                  {field.fileName}
                </span>
              ) : (
                <span className="text-xs text-content-dim">No file selected</span>
              )}
              <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded bg-surface-secondary px-2 py-1 text-xs text-content-secondary transition-colors hover:bg-surface-secondary">
                <UploadIcon size={12} />
                {field.fileName ? "Change" : "Choose"}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(idx, file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}

          <button
            onClick={() => removeField(idx)}
            className="flex h-6 w-6 items-center justify-center rounded text-content-muted transition-colors hover:bg-surface-secondary hover:text-red-400"
          >
            <XIcon size={14} />
          </button>
        </div>
      ))}

      <button
        onClick={addField}
        className="mt-1 flex items-center gap-1 text-xs text-tilli-light transition-colors hover:text-tilli-light"
      >
        <PlusIcon size={12} /> Add Field
      </button>
    </div>
  );
}
