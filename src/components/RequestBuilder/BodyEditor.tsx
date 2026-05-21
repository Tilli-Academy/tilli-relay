"use client";

import { useCallback } from "react";
import { BodyType, FormDataField } from "@/lib/types";
import FormDataEditor from "./FormDataEditor";

export default function BodyEditor({
  body,
  bodyType,
  formData,
  onChange,
  onBodyTypeChange,
  onFormDataChange,
}: {
  body: string;
  bodyType: BodyType;
  formData: FormDataField[];
  onChange: (b: string) => void;
  onBodyTypeChange: (t: BodyType) => void;
  onFormDataChange: (f: FormDataField[]) => void;
}) {
  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(body);
      onChange(JSON.stringify(parsed, null, 2));
    } catch {
      // Not valid JSON, do nothing
    }
  }, [body, onChange]);

  const isValidJson = (() => {
    try {
      JSON.parse(body);
      return true;
    } catch {
      return false;
    }
  })();

  const types: { value: BodyType; label: string }[] = [
    { value: "none", label: "None" },
    { value: "json", label: "JSON" },
    { value: "text", label: "Text" },
    { value: "form-data", label: "Form Data" },
  ];

  return (
    <div data-testid="body-editor" className="space-y-2">
      {/* Body type tabs */}
      <div className="flex items-center gap-1">
        {types.map((t) => (
          <button
            key={t.value}
            data-testid={`body-type-${t.value}`}
            onClick={() => onBodyTypeChange(t.value)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              bodyType === t.value
                ? "bg-tilli text-white"
                : "text-content-muted hover:text-content-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
        {/* Format button for JSON mode */}
        {bodyType === "json" && body && (
          <button
            data-testid="body-format-json"
            onClick={handleFormat}
            disabled={!isValidJson}
            className="ml-auto text-xs text-tilli-light transition-colors hover:text-tilli-light disabled:text-content-dim"
          >
            Format JSON
          </button>
        )}
      </div>

      {/* Body content based on type */}
      {bodyType === "none" && (
        <p className="py-4 text-center text-xs text-content-dim">
          This request does not have a body
        </p>
      )}

      {bodyType === "json" && (
        <textarea
          data-testid="body-json-input"
          value={body}
          onChange={(e) => onChange(e.target.value)}
          placeholder='{"key": "value"}'
          rows={8}
          spellCheck={false}
          className="w-full resize-y rounded border border-border-primary bg-surface-secondary px-3 py-2 font-mono text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
        />
      )}

      {bodyType === "text" && (
        <textarea
          data-testid="body-text-input"
          value={body}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Raw text body"
          rows={8}
          spellCheck={false}
          className="w-full resize-y rounded border border-border-primary bg-surface-secondary px-3 py-2 font-mono text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
        />
      )}

      {bodyType === "form-data" && (
        <FormDataEditor
          fields={formData.length > 0 ? formData : [{ key: "", value: "", type: "text", enabled: true }]}
          onChange={onFormDataChange}
        />
      )}
    </div>
  );
}
