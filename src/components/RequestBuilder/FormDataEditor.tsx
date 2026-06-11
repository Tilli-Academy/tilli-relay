"use client";

import { useState, useCallback } from "react";
import { FormDataField } from "@/lib/types";
import { XIcon, PlusIcon, UploadIcon } from "@/components/Icons";
import { showToast } from "@/components/Toast/Toast";
import { api, authFetch } from "@/lib/apiBase";

const INPUT_CLASS =
  "w-full rounded-none border-0 bg-transparent px-3 py-2 text-sm text-content-primary placeholder-content-dim outline-none focus:outline-none";

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
    <div>
      {/* Table */}
      <div className="overflow-hidden rounded border border-border-primary">
        {/* Header row */}
        <div className="flex items-center border-b border-border-primary bg-surface-secondary/50 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
          <span className="flex w-10 shrink-0 items-center justify-center" />
          <span className="w-40 border-l border-border-primary px-3 py-1.5">Key</span>
          <span className="w-20 border-l border-border-primary px-3 py-1.5">Type</span>
          <span className="flex-1 border-l border-border-primary px-3 py-1.5">Value</span>
          <span className="w-9 shrink-0 border-l border-border-primary" />
        </div>

        {/* Data rows */}
        {fields.map((field, idx) => (
          <div
            key={idx}
            className={`group flex items-center border-b border-border-primary last:border-b-0 transition-colors hover:bg-surface-secondary/30 ${
              !field.enabled ? "opacity-50" : ""
            }`}
          >
            <span className="flex w-10 shrink-0 items-center justify-center">
              <input
                type="checkbox"
                checked={field.enabled}
                onChange={(e) => updateField(idx, { enabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-tilli"
              />
            </span>
            <span className="w-40 border-l border-border-primary">
              <input
                type="text"
                placeholder="Key"
                value={field.key}
                onChange={(e) => updateField(idx, { key: e.target.value })}
                className={INPUT_CLASS}
              />
            </span>
            <span className="w-20 border-l border-border-primary">
              <select
                value={field.type}
                onChange={(e) => {
                  const newType = e.target.value as "text" | "file";
                  updateField(idx, { type: newType, value: "", fileName: undefined, fileId: undefined });
                }}
                className="w-full rounded-none border-0 bg-transparent px-2 py-2 text-xs text-content-secondary outline-none focus:outline-none"
              >
                <option value="text">Text</option>
                <option value="file">File</option>
              </select>
            </span>
            <span className="flex flex-1 items-center border-l border-border-primary">
              {field.type === "text" ? (
                <input
                  type="text"
                  placeholder="Value"
                  value={field.value}
                  onChange={(e) => updateField(idx, { value: e.target.value })}
                  className={INPUT_CLASS}
                />
              ) : (
                <div className="flex flex-1 items-center gap-2 px-3 py-1.5">
                  {uploadingIdx === idx ? (
                    <span className="text-xs text-content-muted">Uploading...</span>
                  ) : field.fileName ? (
                    <span className="truncate text-xs text-content-secondary" title={field.fileName}>
                      {field.fileName}
                    </span>
                  ) : (
                    <span className="text-xs text-content-dim">No file selected</span>
                  )}
                  <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-1 rounded bg-surface-secondary px-2 py-1 text-xs text-content-secondary transition-colors hover:bg-surface-tertiary">
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
            </span>
            <span className="flex w-9 shrink-0 items-center justify-center border-l border-border-primary">
              <button
                onClick={() => removeField(idx)}
                className="rounded p-1 text-content-dim opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
              >
                <XIcon size={12} />
              </button>
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={addField}
        className="mt-2 flex items-center gap-1 text-xs text-content-muted transition-colors hover:text-tilli-light"
      >
        <PlusIcon size={12} /> Add Field
      </button>
    </div>
  );
}
