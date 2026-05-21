"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import WorkspaceLayout from "@/components/Layout/WorkspaceLayout";
import TabBar from "@/components/TabBar/TabBar";
import Sidebar from "@/components/Sidebar/Sidebar";
import RequestBuilder from "@/components/RequestBuilder/RequestBuilder";
import CurlPanel from "@/components/CurlPanel/CurlPanel";
import ResponseViewer from "@/components/ResponseViewer/ResponseViewer";
import ToastContainer, { showToast } from "@/components/Toast/Toast";
import { useTabManager } from "@/hooks/useTabManager";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useWorkspace } from "@/hooks/useWorkspace";
import { HistoryEntry } from "@/components/ResponseViewer/ResponseHistory";
import { parseCurl } from "@/lib/curl/parser";
import ErrorBoundary from "@/components/ErrorBoundary/ErrorBoundary";
import EnvironmentPanel from "@/components/EnvironmentPanel/EnvironmentPanel";
import EnvironmentSwitcher, { Environment } from "@/components/EnvironmentSwitcher/EnvironmentSwitcher";
import SearchOverlay from "@/components/SearchOverlay/SearchOverlay";
import WorkspaceSwitcherComponent, { TeamInfo } from "@/components/WorkspaceSwitcher/WorkspaceSwitcher";
import TeamPanel from "@/components/TeamPanel/TeamPanel";
import ActivityLog from "@/components/ActivityLog/ActivityLog";
import ShareDialog from "@/components/ShareDialog/ShareDialog";
import { EnvironmentVariable } from "@/lib/types";
import { api, getApiBase } from "@/lib/apiBase";

interface SavedRequest {
  id: string;
  name: string;
  curl: string;
}

interface CollectionWithRequests {
  id: string;
  name: string;
  folderId: string | null;
  requests: Array<{
    id: string;
    request: SavedRequest;
  }>;
}

interface Folder {
  id: string;
  name: string;
  collections: CollectionWithRequests[];
}

export default function Home() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const {
    tabs,
    activeTabId,
    activeTab,
    createTab,
    closeTab,
    switchTab,
    setMethod,
    setUrl,
    setHeaders,
    setParams,
    setBody,
    setBodyType,
    setFormData,
    setAuth,
    updateActiveState,
    updateFromCurl,
    setTabResult,
    setActiveTabName,
    setActiveSavedRequestId,
  } = useTabManager(user?.id);

  // Workspace state
  const {
    workspace,
    switchToPersonal,
    switchToTeam,
    teamHeaders,
    canWrite,
    isTeam,
    isOwner,
  } = useWorkspace(user?.id);

  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Ref to capture workspace headers for async operations
  const teamHeadersRef = useRef(teamHeaders);
  teamHeadersRef.current = teamHeaders;

  // Ref to capture active tab for async operations (avoids stale closures)
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // When the URL changes, extract query params into the Params tab
  const handleUrlChange = useCallback((url: string) => {
    const qIdx = url.indexOf("?");
    if (qIdx !== -1) {
      const baseUrl = url.slice(0, qIdx);
      const queryStr = url.slice(qIdx + 1);
      const extracted = queryStr.split("&").filter(Boolean).map((pair) => {
        const eqIdx = pair.indexOf("=");
        if (eqIdx !== -1) {
          return { key: pair.slice(0, eqIdx), value: pair.slice(eqIdx + 1), enabled: true };
        }
        return { key: pair, value: "", enabled: true };
      });
      updateActiveState({
        url: baseUrl,
        params: extracted.length > 0 ? extracted : [{ key: "", value: "", enabled: true }],
      });
    } else {
      setUrl(url);
    }
  }, [setUrl, updateActiveState]);

  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const historyIdRef = useRef(0);
  const [importing, setImporting] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(true);

  // Sidebar state
  const [requests, setRequests] = useState<SavedRequest[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [collections, setCollections] = useState<CollectionWithRequests[]>([]);

  // Environment variables state
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const [envPanelOpen, setEnvPanelOpen] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);

  // Save prompt trigger from keyboard shortcut
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Helper: fetch with team headers
  const teamFetch = useCallback((url: string, opts?: RequestInit) => {
    const headers = {
      ...teamHeadersRef.current,
      ...(opts?.headers || {}),
    };
    return fetch(url, { ...opts, headers });
  }, []);

  // Fetch user info on mount
  useEffect(() => {
    fetchUser();
  }, []);

  // Re-fetch workspace data when workspace changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setSidebarLoading(true);
      // If we're in team mode, validate the team still exists before fetching data
      if (workspace.type === "team") {
        try {
          const teamsRes = await fetch(api("/api/teams"), { cache: "no-store" });
          if (teamsRes.ok) {
            const teamsList: TeamInfo[] = await teamsRes.json();
            if (!cancelled) setTeams(teamsList);
            const stillMember = teamsList.some((t) => t.id === (workspace as { teamId: string }).teamId);
            if (!stillMember) {
              // Team was deleted or user was removed — switch to personal
              switchToPersonal();
              return; // workspace change will re-trigger this effect
            }
          }
        } catch {}
      }
      if (cancelled) return;
      await Promise.all([fetchRequests(), fetchCollections(), fetchEnvironments(), fetchTeams(), fetchHistory()]);
      if (!cancelled) setSidebarLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [workspace]);

  // Poll for team changes every 10 seconds so team members see each other's updates
  useEffect(() => {
    if (!isTeam) return;
    const interval = setInterval(() => {
      fetchRequests();
      fetchCollections();
      fetchEnvironments();
    }, 10000);
    return () => clearInterval(interval);
  }, [isTeam, workspace]);

  const fetchUser = async () => {
    try {
      const res = await fetch(api("/api/auth/me"), { cache: "no-store", credentials: "include" });
      if (res.ok) {
        setUser(await res.json());
        setAuthChecked(true);
      } else {
        window.location.href = getApiBase() + "/login";
        return;
      }
    } catch (err) {
      console.error("Failed to fetch user:", err);
      window.location.href = getApiBase() + "/login";
      return;
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch(api("/api/teams"), { cache: "no-store" });
      if (res.ok) {
        setTeams(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await teamFetch(api("/api/requests"), { cache: "no-store" });
      if (res.ok) {
        setRequests(await res.json());
      } else if (res.status === 403) {
        setRequests([]);
      } else {
        console.error("Failed to fetch requests:", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    }
  };

  const fetchCollections = async () => {
    try {
      const res = await teamFetch(api("/api/folders"), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders ?? []);
        setCollections(data.collections ?? []);
      } else if (res.status === 403) {
        setFolders([]);
        setCollections([]);
      } else {
        console.error("Failed to fetch folders/collections:", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch folders/collections:", err);
    }
  };

  const fetchEnvVars = async (environmentId?: string) => {
    try {
      const url = environmentId
        ? api(`/api/variables?environmentId=${environmentId}`)
        : api("/api/variables");
      const res = await teamFetch(url, { cache: "no-store" });
      if (res.ok) {
        setEnvVars(await res.json());
      } else if (res.status === 403) {
        // Team was deleted or access revoked — silently clear vars
        setEnvVars([]);
      } else {
        console.error("Failed to fetch env vars:", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch env vars:", err);
    }
  };

  const fetchEnvironments = async () => {
    try {
      const res = await teamFetch(api("/api/environments"), { cache: "no-store" });
      if (res.ok) {
        const envs: Environment[] = await res.json();
        setEnvironments(envs);
        const active = envs.find((e) => e.isActive);
        if (active) {
          fetchEnvVars(active.id);
        }
      } else if (res.status === 403) {
        setEnvironments([]);
        setEnvVars([]);
      } else {
        console.error("Failed to fetch environments:", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch environments:", err);
    }
  };

  const handleSwitchEnvironment = useCallback(async (envId: string) => {
    try {
      const res = await teamFetch(api(`/api/environments/${envId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) {
        fetchEnvironments();
        showToast("Environment switched", "success");
      }
    } catch {
      showToast("Failed to switch environment", "error");
    }
  }, [teamFetch]);

  const handleClearEnvironment = useCallback(async () => {
    const active = environments.find((e) => e.isActive);
    if (!active) return;
    try {
      const res = await teamFetch(api(`/api/environments/${active.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (res.ok) {
        fetchEnvironments();
        setEnvVars([]);
        showToast("Environment cleared", "success");
      }
    } catch {
      showToast("Failed to clear environment", "error");
    }
  }, [environments, teamFetch]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(api("/api/history?limit=50"), { cache: "no-store" });
      if (res.ok) {
        const entries = await res.json();
        setHistory(
          entries.map((e: { id: string; method: string; url: string; statusCode: number; timeMs: number; createdAt: string; responseHeaders: string; responseBody: string }) => ({
            id: e.id,
            method: e.method,
            url: e.url,
            status: e.statusCode,
            timeMs: e.timeMs,
            timestamp: new Date(e.createdAt).getTime(),
            result: {
              status: e.statusCode,
              headers: typeof e.responseHeaders === "string" ? JSON.parse(e.responseHeaders) : e.responseHeaders,
              body: e.responseBody,
              timeMs: e.timeMs,
            },
          }))
        );
        historyIdRef.current = entries.length;
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

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

        // Persist to DB (fire-and-forget) — history is personal, no team headers
        fetch(api("/api/history"), {
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
  }, [sending, setTabResult, setActiveSavedRequestId, setActiveTabName, teamFetch]);

  // Load a saved request — always opens in a new tab
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
    [setActiveSavedRequestId, setActiveTabName, teamFetch]
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
    [teamFetch]
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
    [teamFetch]
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
    [teamFetch]
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
    [teamFetch]
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
  }, [teamFetch]);

  // New request — create a new tab
  const handleNewRequest = useCallback(() => {
    createTab();
  }, [createTab]);

  // History handlers
  const handleSelectHistory = useCallback((entry: HistoryEntry) => {
    setTabResult(activeTabRef.current.id, entry.result);
  }, [setTabResult]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    fetch(api("/api/history"), { method: "DELETE" }).catch(() => {});
  }, []);

  // Logout handler
  const handleLogout = useCallback(async () => {
    try {
      await fetch(api("/api/auth/logout"), { method: "POST" });
      window.location.href = getApiBase() + "/login";
    } catch {
      showToast("Logout failed", "error");
    }
  }, []);

  // Workspace switch handlers
  const handleSwitchPersonal = useCallback(() => {
    switchToPersonal();
  }, [switchToPersonal]);

  const handleSwitchTeam = useCallback((teamId: string, teamName: string, role: "owner" | "editor" | "viewer") => {
    switchToTeam(teamId, teamName, role);
  }, [switchToTeam]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSend: handleSend,
    onSave: () => setSavePromptOpen(true),
    onFocusUrl: () => urlInputRef.current?.focus(),
    onSearch: () => setSearchOpen((p) => !p),
    onToggleEnv: () => setEnvPanelOpen((p) => !p),
    onToggleSidebar: () => setSidebarVisible((p) => !p),
  });

  // Show loading spinner until auth is confirmed
  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-secondary border-t-tilli" />
          <p className="text-xs text-content-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <WorkspaceLayout
        sidebarVisible={sidebarVisible}
        envSwitcher={
          <EnvironmentSwitcher
            environments={environments}
            onSwitch={handleSwitchEnvironment}
            onClear={handleClearEnvironment}
            onManage={() => setEnvPanelOpen(true)}
          />
        }
        sidebar={
          <ErrorBoundary fallbackLabel="Sidebar error">
            <Sidebar
              requests={requests}
              folders={folders}
              collections={collections}
              activeRequestId={activeTab.savedRequestId}
              onLoadRequest={handleLoadRequest}
              onSaveRequest={handleSaveRequest}
              onDeleteRequest={handleDeleteRequest}
              onDeleteFolder={handleDeleteFolder}
              onDeleteCollection={handleDeleteCollection}
              onRemoveFromCollection={handleRemoveFromCollection}
              onImportPostman={handleImportPostman}
              importing={importing}
              onNewRequest={handleNewRequest}
              loading={sidebarLoading}
              savePromptOpen={savePromptOpen}
              onSavePromptClose={() => setSavePromptOpen(false)}
              user={user}
              onLogout={handleLogout}
              onOpenEnvironment={() => setEnvPanelOpen(true)}
              onCollectionsChange={fetchCollections}
              getCurrentCurl={() => activeTabRef.current.curlString}
              canWrite={canWrite}
              workspace={workspace}
              teams={teams}
              onSwitchPersonal={handleSwitchPersonal}
              onSwitchTeam={handleSwitchTeam}
              onManageTeams={() => setTeamPanelOpen(true)}
              onViewActivity={() => setActivityPanelOpen(true)}
              teamHeaders={teamHeaders}
              onShareRequest={(requestId) => {
                // Find the request to get its name for the dialog
                const req = requests.find((r) => r.id === requestId);
                if (req) setActiveTabName(req.name);
                setActiveSavedRequestId(requestId);
                setShareDialogOpen(true);
              }}
            />
          </ErrorBoundary>
        }
        tabBar={
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSwitch={switchTab}
            onClose={closeTab}
            onNew={handleNewRequest}
          />
        }
        builder={
          <ErrorBoundary fallbackLabel="Request builder error">
            <RequestBuilder
              ref={urlInputRef}
              key={activeTabId}
              state={activeTab.state}
              onMethodChange={setMethod}
              onUrlChange={handleUrlChange}
              onHeadersChange={setHeaders}
              onParamsChange={setParams}
              onBodyChange={setBody}
              onBodyTypeChange={setBodyType}
              onFormDataChange={setFormData}
              onAuthChange={setAuth}
              onSend={handleSend}
              sending={sending}
            />
          </ErrorBoundary>
        }
        curlPanel={
          <ErrorBoundary fallbackLabel="Curl panel error">
            <CurlPanel
              key={activeTabId}
              curlString={activeTab.curlString}
              onCurlChange={updateFromCurl}
            />
          </ErrorBoundary>
        }
        response={
          <ErrorBoundary fallbackLabel="Response viewer error">
            <ResponseViewer
              result={activeTab.result}
              sending={sending}
              history={history}
              onSelectHistory={handleSelectHistory}
              onClearHistory={handleClearHistory}
            />
          </ErrorBoundary>
        }
      />
      <EnvironmentPanel
        open={envPanelOpen}
        onClose={() => setEnvPanelOpen(false)}
        environments={environments}
        variables={envVars}
        onEnvironmentsChange={fetchEnvironments}
        onVariablesChange={fetchEnvVars}
        activeEnvironmentId={environments.find((e) => e.isActive)?.id || null}
        teamHeaders={teamHeaders}
      />
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        folders={folders}
        collections={collections}
        requests={requests}
        onLoadRequest={handleLoadRequest}
      />
      <TeamPanel
        open={teamPanelOpen}
        onClose={() => setTeamPanelOpen(false)}
        workspace={workspace}
        onWorkspaceChange={() => {
          fetchTeams();
          fetchCollections();
          fetchRequests();
        }}
        onSwitchTeam={handleSwitchTeam}
        onSwitchPersonal={handleSwitchPersonal}
      />
      <ActivityLog
        open={activityPanelOpen}
        onClose={() => setActivityPanelOpen(false)}
        workspace={workspace}
      />
      <ShareDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        requestId={activeTab.savedRequestId}
        requestName={activeTab.name || "Untitled Request"}
      />
      <ToastContainer />
    </>
  );
}
