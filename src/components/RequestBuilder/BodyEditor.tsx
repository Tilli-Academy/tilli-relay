"use client";

import { useCallback } from "react";
import { BodyType, FormDataField } from "@/lib/types";
import FormDataEditor from "./FormDataEditor";

const BRACKET_PAIRS: Record<string, string> = { "{": "}", "[": "]", "(": ")" };
const CLOSE_BRACKETS = new Set(["}", "]", ")"]);

function handleSmartKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  body: string,
  onChange: (b: string) => void,
) {
  const ta = e.currentTarget;
  const { selectionStart: start, selectionEnd: end } = ta;

  // Auto-close brackets: { → {}, [ → [], ( → ()
  const closing = BRACKET_PAIRS[e.key];
  if (closing) {
    e.preventDefault();
    const before = body.slice(0, start);
    const after = body.slice(end);
    const newValue = before + e.key + closing + after;
    onChange(newValue);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 1;
    });
    return;
  }

  // Skip over closing bracket if already there
  if (CLOSE_BRACKETS.has(e.key) && body[start] === e.key && start === end) {
    e.preventDefault();
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 1;
    });
    return;
  }

  // Auto-close quotes: " → ""
  if (e.key === '"' && !e.ctrlKey && !e.metaKey) {
    if (body[start] === '"' && start === end) {
      e.preventDefault();
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1;
      });
    } else {
      e.preventDefault();
      const before = body.slice(0, start);
      const after = body.slice(end);
      onChange(before + '""' + after);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1;
      });
    }
    return;
  }

  // Smart Enter: auto-indent and expand brackets
  if (e.key === "Enter") {
    e.preventDefault();
    const before = body.slice(0, start);
    const after = body.slice(end);

    const currentLine = before.split("\n").pop() || "";
    const indent = currentLine.match(/^(\s*)/)?.[1] || "";

    const charBefore = before.trimEnd().slice(-1);
    const charAfter = after.trimStart()[0];

    const isExpanding =
      (charBefore === "{" && charAfter === "}") ||
      (charBefore === "[" && charAfter === "]");

    const shouldIndent = ["{", "["].includes(charBefore);

    if (isExpanding) {
      const inner = indent + "  ";
      const newValue = before + "\n" + inner + "\n" + indent + after;
      onChange(newValue);
      const cursorPos = before.length + 1 + inner.length;
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = cursorPos;
      });
    } else if (shouldIndent) {
      const inner = indent + "  ";
      const newValue = before + "\n" + inner + after;
      onChange(newValue);
      const cursorPos = before.length + 1 + inner.length;
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = cursorPos;
      });
    } else {
      const newValue = before + "\n" + indent + after;
      onChange(newValue);
      const cursorPos = before.length + 1 + indent.length;
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = cursorPos;
      });
    }
    return;
  }

  // Backspace: delete matching pair if cursor is between them
  if (e.key === "Backspace" && start === end && start > 0) {
    const charBefore = body[start - 1];
    const charAfter = body[start];
    if (BRACKET_PAIRS[charBefore] === charAfter || (charBefore === '"' && charAfter === '"')) {
      e.preventDefault();
      const newValue = body.slice(0, start - 1) + body.slice(start + 1);
      onChange(newValue);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start - 1;
      });
      return;
    }
  }

  // Tab key: insert 2 spaces
  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    const before = body.slice(0, start);
    const after = body.slice(end);
    onChange(before + "  " + after);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 2;
    });
    return;
  }
}

const TEXTAREA_CLASS =
  "w-full min-h-[200px] resize-y rounded border border-border-primary bg-surface-secondary px-3 py-2.5 font-mono text-sm leading-relaxed text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none";

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
    { value: "text", label: "Raw" },
    { value: "form-data", label: "Form Data" },
  ];

  return (
    <div data-testid="body-editor" className="space-y-3">
      {/* Body type selector + format button */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 rounded border border-border-primary bg-surface-secondary p-0.5">
          {types.map((t) => (
            <button
              key={t.value}
              data-testid={`body-type-${t.value}`}
              onClick={() => onBodyTypeChange(t.value)}
              className={`rounded px-3 py-1 text-xs font-medium transition-all ${
                bodyType === t.value
                  ? "bg-tilli text-white shadow-sm"
                  : "text-content-muted hover:text-content-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {bodyType === "json" && body && (
          <button
            data-testid="body-format-json"
            onClick={handleFormat}
            disabled={!isValidJson}
            className="text-xs text-tilli-light transition-colors hover:text-tilli-light disabled:text-content-dim"
          >
            Beautify
          </button>
        )}
      </div>

      {/* Body content */}
      {bodyType === "none" && (
        <p className="py-6 text-center text-xs text-content-dim">
          This request does not have a body
        </p>
      )}

      {bodyType === "json" && (
        <textarea
          data-testid="body-json-input"
          value={body}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => handleSmartKeyDown(e, body, onChange)}
          placeholder='{"key": "value"}'
          rows={10}
          spellCheck={false}
          className={TEXTAREA_CLASS}
        />
      )}

      {bodyType === "text" && (
        <textarea
          data-testid="body-text-input"
          value={body}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => handleSmartKeyDown(e, body, onChange)}
          placeholder="Raw text body"
          rows={10}
          spellCheck={false}
          className={TEXTAREA_CLASS}
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
