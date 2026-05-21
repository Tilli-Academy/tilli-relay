"use client";

import React, { useState, useMemo, useEffect } from "react";

const INITIAL_LINES = 500;
const LOAD_MORE_LINES = 500;

export default function PaginatedRawView({
  text,
  highlighter,
}: {
  text: string;
  highlighter?: (text: string) => React.ReactNode;
}) {
  const lines = useMemo(() => text.split("\n"), [text]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_LINES);

  // Reset when text changes
  useEffect(() => {
    setVisibleCount(INITIAL_LINES);
  }, [text]);

  const isTruncated = lines.length > visibleCount;
  const remaining = lines.length - visibleCount;

  const visibleText = useMemo(() => {
    if (!isTruncated) return text;
    return lines.slice(0, visibleCount).join("\n");
  }, [lines, visibleCount, isTruncated, text]);

  const content = highlighter ? highlighter(visibleText) : visibleText;

  return (
    <div>
      <pre className="whitespace-pre-wrap rounded bg-surface-primary p-3 font-mono text-xs leading-relaxed text-content-secondary">
        {content || "(empty body)"}
      </pre>
      {isTruncated && (
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_LINES)}
            className="rounded bg-surface-secondary px-3 py-1 text-xs text-content-secondary transition-colors hover:bg-surface-secondary"
          >
            Show More ({Math.min(LOAD_MORE_LINES, remaining).toLocaleString()} lines)
          </button>
          <button
            onClick={() => setVisibleCount(lines.length)}
            className="text-xs text-content-muted transition-colors hover:text-content-secondary"
          >
            Load All ({remaining.toLocaleString()} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
