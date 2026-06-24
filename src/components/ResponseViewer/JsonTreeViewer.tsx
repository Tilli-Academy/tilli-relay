"use client";

import React, { useState } from "react";

const ARRAY_PAGE_SIZE = 100;
const OBJECT_PAGE_SIZE = 100;
const MAX_EXPANDED_DEPTH = 2;
const MAX_DEPTH = 50;

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-syntax-null">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-syntax-boolean">{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-syntax-number">{String(value)}</span>;
  }
  if (typeof value === "string") {
    return <span className="text-syntax-string">&quot;{value}&quot;</span>;
  }
  return <span className="text-content-tertiary">{String(value)}</span>;
}

function JsonArrayNode({
  name,
  value,
  depth,
}: {
  name?: string;
  value: unknown[];
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < MAX_EXPANDED_DEPTH);
  const [visibleCount, setVisibleCount] = useState(ARRAY_PAGE_SIZE);
  const remaining = value.length - visibleCount;

  if (depth >= MAX_DEPTH) {
    return (
      <div className="ml-4">
        {name !== undefined && <span className="text-syntax-key">&quot;{name}&quot;</span>}
        {name !== undefined && <span className="text-syntax-punctuation">: </span>}
        <span className="text-syntax-null">[...] (max depth)</span>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-left hover:bg-surface-tertiary"
      >
        <span className="w-3 text-center text-syntax-punctuation">{expanded ? "▼" : "▶"}</span>
        {name !== undefined && <span className="text-syntax-key">&quot;{name}&quot;</span>}
        {name !== undefined && <span className="text-syntax-punctuation">: </span>}
        <span className="text-syntax-punctuation">
          {expanded ? "[" : `[...] ${value.length} items`}
        </span>
      </button>
      {expanded && (
        <div className="ml-4 border-l border-border-secondary pl-2">
          {value.slice(0, visibleCount).map((item, idx) => (
            <div key={idx} className="flex">
              <span className="mr-1 shrink-0 text-syntax-punctuation">{idx}</span>
              <span className="text-syntax-punctuation">: </span>
              <JsonNode value={item} depth={depth + 1} />
            </div>
          ))}
          {remaining > 0 && (
            <button
              onClick={() => setVisibleCount((p) => p + ARRAY_PAGE_SIZE)}
              className="mt-1 text-xs text-tilli-light hover:text-tilli-light"
            >
              Show next {Math.min(ARRAY_PAGE_SIZE, remaining)} items ({remaining} remaining)
            </button>
          )}
          <span className="text-syntax-punctuation">]</span>
        </div>
      )}
    </div>
  );
}

function JsonObjectNode({
  name,
  value,
  depth,
}: {
  name?: string;
  value: Record<string, unknown>;
  depth: number;
}) {
  const keys = Object.keys(value);
  const [expanded, setExpanded] = useState(depth < MAX_EXPANDED_DEPTH);
  const [visibleCount, setVisibleCount] = useState(OBJECT_PAGE_SIZE);
  const remaining = keys.length - visibleCount;

  if (depth >= MAX_DEPTH) {
    return (
      <div className="ml-4">
        {name !== undefined && <span className="text-syntax-key">&quot;{name}&quot;</span>}
        {name !== undefined && <span className="text-syntax-punctuation">: </span>}
        <span className="text-syntax-null">{"{...}"} (max depth)</span>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-left hover:bg-surface-tertiary"
      >
        <span className="w-3 text-center text-syntax-punctuation">{expanded ? "▼" : "▶"}</span>
        {name !== undefined && <span className="text-syntax-key">&quot;{name}&quot;</span>}
        {name !== undefined && <span className="text-syntax-punctuation">: </span>}
        <span className="text-syntax-punctuation">
          {expanded ? "{" : `{...} ${keys.length} keys`}
        </span>
      </button>
      {expanded && (
        <div className="ml-4 border-l border-border-secondary pl-2">
          {keys.slice(0, visibleCount).map((key) => (
            <div key={key}>
              <JsonNode name={key} value={value[key]} depth={depth + 1} />
            </div>
          ))}
          {remaining > 0 && (
            <button
              onClick={() => setVisibleCount((p) => p + OBJECT_PAGE_SIZE)}
              className="mt-1 text-xs text-tilli-light hover:text-tilli-light"
            >
              Show next {Math.min(OBJECT_PAGE_SIZE, remaining)} keys ({remaining} remaining)
            </button>
          )}
          <span className="text-syntax-punctuation">{"}"}</span>
        </div>
      )}
    </div>
  );
}

function JsonNode({
  name,
  value,
  depth = 0,
}: {
  name?: string;
  value: unknown;
  depth?: number;
}) {
  if (value === null || typeof value !== "object") {
    return (
      <span>
        {name !== undefined && <span className="text-syntax-key">&quot;{name}&quot;</span>}
        {name !== undefined && <span className="text-syntax-punctuation">: </span>}
        <JsonPrimitive value={value} />
      </span>
    );
  }

  if (Array.isArray(value)) {
    return <JsonArrayNode name={name} value={value} depth={depth} />;
  }

  return <JsonObjectNode name={name} value={value as Record<string, unknown>} depth={depth} />;
}

export default function JsonTreeViewer({ data }: { data: unknown }) {
  return (
    <div className="rounded bg-surface-primary p-3 font-mono text-xs leading-relaxed">
      <JsonNode value={data} depth={0} />
    </div>
  );
}
