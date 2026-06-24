"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { showToast } from "@/components/Toast/Toast";
import { HistoryEntry } from "@/components/ResponseViewer/ResponseHistory";
import { Environment } from "@/components/EnvironmentSwitcher/EnvironmentSwitcher";
import { TeamInfo } from "@/components/WorkspaceSwitcher/WorkspaceSwitcher";
import { EnvironmentVariable } from "@/lib/types";
import { Workspace } from "@/hooks/useWorkspace";
import { SavedRequest, CollectionWithRequests, Folder } from "@/lib/workspaceTypes";
import { api, authFetch } from "@/lib/apiBase";

interface UseWorkspaceDataParams {
  workspace: Workspace;
  teamHeaders: Record<string, string>;
  isTeam: boolean;
  switchToPersonal: () => void;
}

export function useWorkspaceData({
  workspace,
  teamHeaders,
  isTeam,
  switchToPersonal,
}: UseWorkspaceDataParams) {
  const [requests, setRequests] = useState<SavedRequest[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [collections, setCollections] = useState<CollectionWithRequests[]>([]);
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const historyIdRef = useRef(0);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // Ref to capture workspace headers for async operations
  const teamHeadersRef = useRef(teamHeaders);
  teamHeadersRef.current = teamHeaders;

  // Helper: fetch with team headers + auth headers
  const teamFetch = useCallback((url: string, opts?: RequestInit) => {
    const headers = {
      ...teamHeadersRef.current,
      ...(opts?.headers || {}),
    };
    return authFetch(url, { ...opts, headers });
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await authFetch(api("/api/teams"), { cache: "no-store" });
      if (res.ok) {
        setTeams(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
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
  }, [teamFetch]);

  const fetchCollections = useCallback(async () => {
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
  }, [teamFetch]);

  const fetchEnvVars = useCallback(async (environmentId?: string) => {
    try {
      const url = environmentId
        ? api(`/api/variables?environmentId=${environmentId}`)
        : api("/api/variables");
      const res = await teamFetch(url, { cache: "no-store" });
      if (res.ok) {
        setEnvVars(await res.json());
      } else if (res.status === 403) {
        setEnvVars([]);
      } else {
        console.error("Failed to fetch env vars:", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch env vars:", err);
    }
  }, [teamFetch]);

  const fetchEnvironments = useCallback(async () => {
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
  }, [teamFetch, fetchEnvVars]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await authFetch(api("/api/history?limit=50"), { cache: "no-store" });
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
  }, []);

  // Re-fetch workspace data when workspace changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setSidebarLoading(true);
      // If we're in team mode, validate the team still exists before fetching data
      if (workspace.type === "team") {
        try {
          const teamsRes = await authFetch(api("/api/teams"), { cache: "no-store" });
          if (teamsRes.ok) {
            const teamsList: TeamInfo[] = await teamsRes.json();
            if (!cancelled) setTeams(teamsList);
            const stillMember = teamsList.some((t) => t.id === (workspace as { teamId: string }).teamId);
            if (!stillMember) {
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
  }, [teamFetch, fetchEnvironments]);

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
  }, [environments, teamFetch, fetchEnvironments]);

  return {
    // Sidebar data
    requests,
    folders,
    collections,
    sidebarLoading,
    importing,
    setImporting,

    // Environment data
    envVars,
    environments,

    // History data
    history,
    setHistory,
    historyIdRef,

    // Teams
    teams,

    // Fetch functions (exposed so actions can trigger refreshes)
    teamFetch,
    fetchRequests,
    fetchCollections,
    fetchEnvironments,
    fetchEnvVars,
    fetchTeams,

    // Handlers
    handleSwitchEnvironment,
    handleClearEnvironment,
  };
}
