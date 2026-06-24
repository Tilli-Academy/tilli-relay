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
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { useRequestActions } from "@/hooks/useRequestActions";
import ErrorBoundary from "@/components/ErrorBoundary/ErrorBoundary";
import EnvironmentPanel from "@/components/EnvironmentPanel/EnvironmentPanel";
import EnvironmentSwitcher from "@/components/EnvironmentSwitcher/EnvironmentSwitcher";
import SearchOverlay from "@/components/SearchOverlay/SearchOverlay";
import TeamPanel from "@/components/TeamPanel/TeamPanel";
import ActivityLog from "@/components/ActivityLog/ActivityLog";
import ShareDialog from "@/components/ShareDialog/ShareDialog";
import { api, getApiBase, authFetch, clearSessionToken } from "@/lib/apiBase";
import { useThemeProvider, ThemeCtx } from "@/hooks/useTheme";

export default function Home() {
  // --- Theme ---
  const themeCtx = useThemeProvider();

  // --- Auth state (must be before useWorkspace so userId is available) ---
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const res = await authFetch(api("/api/auth/me"), {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          setUser(await res.json());
          setAuthChecked(true);
        } else {
          clearSessionToken();
          window.location.href = getApiBase() + "/login";
          return;
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
        clearSessionToken();
        window.location.href = getApiBase() + "/login";
        return;
      }
    };
    fetchUser();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await authFetch(api("/api/auth/logout"), { method: "POST" });
      clearSessionToken();
      window.location.href = getApiBase() + "/login";
    } catch {
      showToast("Logout failed", "error");
    }
  }, []);

  // --- Workspace context ---
  const {
    workspace,
    switchToPersonal,
    switchToTeam,
    teamHeaders,
    canWrite,
    isTeam,
  } = useWorkspace(user?.id);

  // --- Tab manager ---
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

  // --- Workspace data (fetches, environments, teams) ---
  const {
    requests,
    folders,
    collections,
    sidebarLoading,
    importing,
    setImporting,
    envVars,
    environments,
    history,
    setHistory,
    historyIdRef,
    teams,
    teamFetch,
    fetchRequests,
    fetchCollections,
    fetchEnvironments,
    fetchEnvVars,
    fetchTeams,
    handleSwitchEnvironment,
    handleClearEnvironment,
  } = useWorkspaceData({
    workspace,
    teamHeaders,
    isTeam,
    switchToPersonal,
  });

  // Ref to capture active tab for async operations (avoids stale closures)
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // --- Request actions (CRUD, send, import, history) ---
  const {
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
  } = useRequestActions({
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
  });

  // --- UI-only state ---
  const [envPanelOpen, setEnvPanelOpen] = useState(false);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

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
    <ThemeCtx.Provider value={themeCtx}>
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
    </ThemeCtx.Provider>
  );
}
