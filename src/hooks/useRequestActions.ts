"use client";

import { useState, useCallback, MutableRefObject } from "react";
import { showToast } from "@/components/Toast/Toast";
import { HistoryEntry } from "@/components/ResponseViewer/ResponseHistory";
import { parseCurl } from "@/lib/curl/parser";
import { RequestState, ExecutionResult } from "@/lib/types";
import { SavedRequest } from "@/lib/workspaceTypes";
import { api, authFetch } from "@/lib/apiBase";
import type { Tab } from "@/hooks/useTabManager";

interface UseRequestActionsParams {
  /** Ref to get the latest active tab without stale closures */
  activeTabRef: MutableRefObject<Tab>;
  /** Team-aware fetch helper */
  teamFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  /** Tab manager functions */
  createTab: (name?: string, state?: RequestState, savedRequestId?: string | null) => string;
  setTabResult: (tabId: string, result: ExecutionResult | null) => void;
  setActiveTabName: (name: string) => void;
  setActiveSavedRequestId: (id: string | null) => void;
  /** Data refresh functions */
  fetchRequests: () => Promise<void>;
  fetchCollections: () => Promise<void>;
  fetchTeams: () => Promise<void>;
  /** History state (shared with page.tsx for display) */
  history: HistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
  historyIdRef: MutableRefObject<number>;
  /** Importing state (shared with page.tsx for sidebar display) */
  setImporting: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useRequestActions({
  activeTabRef,
  teamFetch,
  createTab,
  setTabResult,
  setActiveTabName,
  setActiveSavedRequestId,
  fetchRequests,
  fetchCollections,
  fetchTeams,
  history,
  setHistory,
  historyIdRef,
  setImporting,
}: UseRequestActionsParams) {
  const [sending, setSending] = useState(false);

  // Execute curl
  const handleSend = useCallback(async () => {
    if (sending) return;
    const tab = activeTabRef.current;
    setSending(true);
    setTabResult(tab.id, null);
    try {
      const res = await teamFetch(api("/api/execute"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curl: tab.curlString }),
      });
      const data = await res.json();
      if (res.ok) {
        setTabResult(tab.id, data);
        const now = Date.now();
        setHistory((prev) => [{
          id: String(++historyIdRef.current),
          method: tab.state.method,
          url: tab.state.url,
          status: data.status,
          timeMs: data.timeMs,
          timestamp: now,
          result: data,
        }, ...prev].slice(0, 50));

        // Persist to DB (fire-and-forget) -- history is personal, no team headers
        authFetch(api("/api/history"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: tab.state.method,
            url: tab.state.url,
            curl: tab.curlString,
            statusCode: data.status,
            timeMs: data.timeMs,
            responseHeaders: data.headers,
            responseBody: data.body,
          }),
        }).catch(() => {});

        // Auto-save: persist the request so it shows in the sidebar
        const requestName = tab.name && tab.name !== "New Request"
          ? tab.name
          : `${tab.state.method} ${tab.state.url || "untitled"}`;
        try {
          if (tab.savedRequestId) {
            await teamFetch(api(`/api/requests/${tab.savedRequestId}`), {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: requestName, curl: tab.curlString }),
            });
          } else {
            const saveRes = await teamFetch(api("/api/requests"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: requestName, curl: tab.curlString }),
            });
            if (saveRes.ok) {
              const saved = await saveRes.json();
              setActiveSavedRequestId(saved.id);
              setActiveTabName(requestName);
            }
          }
          fetchRequests();
        } catch {
          // Auto-save failed silently
        }
      } else {
        setTabResult(tab.id, {
          status: 0,
          headers: {},
          body: "",
          timeMs: 0,
          error: data.error,
        });
      }
    } catch (err) {
      setTabResult(tab.id, {
        status: 0,
        headers: {},
        body: "",
        timeMs: 0,
        error: String(err),
      });
    } finally {
      setSending(false);
    }
  }, [sending, activeTabRef, teamFetch, setTabResult, setHistory, historyIdRef, setActiveSavedRequestId, setActiveTabName, fetchRequests]);

  // Load a saved request -- always opens in a new tab
  const handleLoadRequest = useCallback(
    (req: SavedRequest) => {
      const parsed = parseCurl(req.curl);
      createTab(req.name, parsed, req.id);
    },
    [createTab]
  );

  // Save current request
  const handleSaveRequest = useCallback(
    async (name: string) => {
      const curlStr = activeTabRef.current.curlString;
      try {
        const res = await teamFetch(api("/api/requests"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, curl: curlStr }),
        });
        if (res.ok) {
          const saved = await res.json();
          setActiveSavedRequestId(saved.id);
          setActiveTabName(name);
          fetchRequests();
          showToast(`Saved "${name}"`, "success");
        } else {
          showToast("Failed to save request", "error");
        }
      } catch {
        showToast("Failed to save request", "error");
      }
    },
    [activeTabRef, teamFetch, setActiveSavedRequestId, setActiveTabName, fetchRequests]
  );

  // Delete a request
  const handleDeleteRequest = useCallback(
    async (id: string) => {
      try {
        await teamFetch(api(`/api/requests/${id}`), { method: "DELETE" });
        fetchRequests();
        showToast("Request deleted", "info");
      } catch {
        showToast("Failed to delete request", "error");
      }
    },
    [teamFetch, fetchRequests]
  );

  // Delete a folder
  const handleDeleteFolder = useCallback(
    async (id: string) => {
      try {
        await teamFetch(api(`/api/folders/${id}`), { method: "DELETE" });
        fetchCollections();
        showToast("Folder deleted", "info");
      } catch {
        showToast("Failed to delete folder", "error");
      }
    },
    [teamFetch, fetchCollections]
  );

  // Delete a collection
  const handleDeleteCollection = useCallback(
    async (id: string) => {
      try {
        await teamFetch(api(`/api/collections/${id}`), { method: "DELETE" });
        fetchCollections();
        fetchRequests();
        showToast("Collection deleted", "info");
      } catch {
        showToast("Failed to delete collection", "error");
      }
    },
    [teamFetch, fetchCollections, fetchRequests]
  );

  // Remove a request from a collection
  const handleRemoveFromCollection = useCallback(
    async (collectionId: string, requestId: string) => {
      try {
        await teamFetch(api(`/api/collections/${collectionId}/requests`), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId }),
        });
        fetchCollections();
        fetchRequests();
        showToast("Removed from collection — request still available under Requests", "info");
      } catch {
        showToast("Failed to remove request", "error");
      }
    },
    [teamFetch, fetchCollections, fetchRequests]
  );

  // Import Postman collection
  const handleImportPostman = useCallback(async (json: unknown, folderId?: string | null) => {
    if (json === null) {
      showToast("Failed to parse file as JSON", "error");
      return;
    }

    setImporting(true);
    try {
      const payload = folderId ? { ...(json as Record<string, unknown>), _folderId: folderId } : json;
      const res = await teamFetch(api("/api/import/postman"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        fetchRequests();
        fetchCollections();
        showToast(
          `Imported "${data.name}" — ${data.imported} request${data.imported !== 1 ? "s" : ""}`,
          "success"
        );
      } else {
        showToast(data.error || "Import failed", "error");
      }
    } catch {
      showToast("Failed to import collection", "error");
    } finally {
      setImporting(false);
    }
  }, [teamFetch, setImporting, fetchRequests, fetchCollections]);

  // New request -- create a new tab
  const handleNewRequest = useCallback(() => {
    createTab();
  }, [createTab]);

  // History handlers
  const handleSelectHistory = useCallback((entry: HistoryEntry) => {
    setTabResult(activeTabRef.current.id, entry.result);
  }, [activeTabRef, setTabResult]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    authFetch(api("/api/history"), { method: "DELETE" }).catch(() => {});
  }, [setHistory]);

  return {
    sending,
    handleSend,
    handleLoadRequest,
    handleSaveRequest,
    handleDeleteRequest,
    handleDeleteFolder,
    handleDeleteCollection,
    handleRemoveFromCollection,
    handleImportPostman,
    handleNewRequest,
    handleSelectHistory,
    handleClearHistory,
  };
}
