"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

const STORAGE_KEY = "reqify-layout";

interface LayoutSizes {
  sidebarWidth: number;
  curlPanelWidth: number;
  responseHeight: number;
}

const DEFAULTS: LayoutSizes = {
  sidebarWidth: 240,
  curlPanelWidth: 400,
  responseHeight: 320,
};

const LIMITS = {
  sidebar: { min: 180, max: 480 },
  curl: { min: 250, max: 700 },
  response: { min: 100, max: 800 },
};

function loadSizes(): LayoutSizes {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch {}
  return DEFAULTS;
}

function saveSizes(sizes: LayoutSizes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch {}
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Invisible overlay to prevent iframes/editors from stealing mouse events during drag */
function DragOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return <div className="fixed inset-0 z-50" />;
}

function ResizeHandle({
  direction,
  onMouseDown,
}: {
  direction: "horizontal" | "vertical";
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  if (direction === "vertical") {
    return (
      <div
        onMouseDown={onMouseDown}
        className="group flex h-2 flex-shrink-0 cursor-row-resize items-center justify-center border-y border-border-secondary bg-surface-primary transition-colors hover:bg-surface-secondary/50"
      >
        <div className="h-0.5 w-10 rounded-full bg-surface-secondary transition-colors group-hover:bg-content-tertiary" />
      </div>
    );
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className="group flex w-2 flex-shrink-0 cursor-col-resize items-center justify-center border-x border-border-secondary bg-surface-primary transition-colors hover:bg-surface-secondary/50"
    >
      <div className="h-10 w-0.5 rounded-full bg-surface-secondary transition-colors group-hover:bg-content-tertiary" />
    </div>
  );
}

export default function WorkspaceLayout({
  sidebar,
  tabBar,
  builder,
  curlPanel,
  response,
  envSwitcher,
  sidebarVisible = true,
}: {
  sidebar: React.ReactNode;
  tabBar: React.ReactNode;
  builder: React.ReactNode;
  curlPanel: React.ReactNode;
  response: React.ReactNode;
  envSwitcher?: React.ReactNode;
  sidebarVisible?: boolean;
}) {
  const [sizes, setSizes] = useState<LayoutSizes>(DEFAULTS);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load persisted sizes on mount
  useEffect(() => {
    setSizes(loadSizes());
  }, []);

  const updateSize = useCallback(
    (key: keyof LayoutSizes, value: number) => {
      setSizes((prev) => {
        const next = { ...prev, [key]: value };
        saveSizes(next);
        return next;
      });
    },
    []
  );

  // Sidebar resize
  const onSidebarDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      const startX = e.clientX;
      const startW = sizes.sidebarWidth;

      const onMove = (ev: MouseEvent) => {
        const newW = clamp(startW + (ev.clientX - startX), LIMITS.sidebar.min, LIMITS.sidebar.max);
        updateSize("sidebarWidth", newW);
      };
      const onUp = () => {
        setDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [sizes.sidebarWidth, updateSize]
  );

  // Curl panel resize (drag from left edge of curl panel)
  const onCurlDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      const startX = e.clientX;
      const startW = sizes.curlPanelWidth;

      const onMove = (ev: MouseEvent) => {
        // Dragging left → wider curl panel, dragging right → narrower
        const newW = clamp(startW - (ev.clientX - startX), LIMITS.curl.min, LIMITS.curl.max);
        updateSize("curlPanelWidth", newW);
      };
      const onUp = () => {
        setDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [sizes.curlPanelWidth, updateSize]
  );

  // Response height resize
  const onResponseDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      const startY = e.clientY;
      const startH = sizes.responseHeight;

      const onMove = (ev: MouseEvent) => {
        const newH = clamp(startH - (ev.clientY - startY), LIMITS.response.min, LIMITS.response.max);
        updateSize("responseHeight", newH);
      };
      const onUp = () => {
        setDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [sizes.responseHeight, updateSize]
  );

  return (
    <div data-testid="workspace-layout" className="flex h-screen overflow-hidden">
      <DragOverlay active={dragging} />

      {/* Sidebar */}
      {sidebarVisible && (
        <>
          <aside
            style={{ width: sizes.sidebarWidth }}
            className="flex-shrink-0 bg-surface-primary"
          >
            {sidebar}
          </aside>

          {/* Sidebar ↔ Main divider */}
          <ResizeHandle direction="horizontal" onMouseDown={onSidebarDragStart} />
        </>
      )}

      {/* Main area */}
      <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden">
        {/* Tab bar + Environment switcher */}
        <div className="flex items-stretch">
          <div className="flex-1 overflow-hidden">{tabBar}</div>
          {envSwitcher && (
            <div className="flex items-center border-b border-border-secondary bg-surface-primary/50 px-2">
              {envSwitcher}
            </div>
          )}
        </div>

        {/* Top: Request builder + Curl panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Request builder */}
          <div className="flex-1 overflow-y-auto p-4">
            {builder}
          </div>

          {/* Builder ↔ Curl divider */}
          <ResizeHandle direction="horizontal" onMouseDown={onCurlDragStart} />

          {/* Curl panel */}
          <div
            style={{ width: sizes.curlPanelWidth }}
            className="flex-shrink-0 overflow-hidden bg-surface-primary/50 p-4"
          >
            {curlPanel}
          </div>
        </div>

        {/* (Builder+Curl) ↔ Response divider */}
        <ResizeHandle direction="vertical" onMouseDown={onResponseDragStart} />

        {/* Bottom: Response viewer */}
        <div
          style={{ height: sizes.responseHeight }}
          className="flex flex-shrink-0 flex-col overflow-y-auto bg-surface-base/50 p-4"
        >
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
            Response
          </h2>
          {response}
        </div>
      </div>
    </div>
  );
}
