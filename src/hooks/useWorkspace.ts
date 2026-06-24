"use client";

import { useState, useCallback, useMemo, useEffect } from "react";

export type TeamRole = "owner" | "editor" | "viewer";

export interface PersonalWorkspace {
  type: "personal";
}

export interface TeamWorkspace {
  type: "team";
  teamId: string;
  teamName: string;
  role: TeamRole;
}

export type Workspace = PersonalWorkspace | TeamWorkspace;

const STORAGE_KEY = "relay-workspace";

function loadWorkspace(userId: string | undefined): Workspace {
  if (!userId || typeof window === "undefined") return { type: "personal" };
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.type === "team" && parsed.teamId && parsed.teamName && parsed.role) {
        return parsed as TeamWorkspace;
      }
    }
  } catch {
    // ignore
  }
  return { type: "personal" };
}

function saveWorkspace(userId: string | undefined, workspace: Workspace) {
  if (!userId || typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(workspace));
}

export function useWorkspace(userId: string | undefined) {
  const [workspace, setWorkspaceState] = useState<Workspace>({ type: "personal" });

  // Load from localStorage once userId is available
  useEffect(() => {
    if (userId) {
      setWorkspaceState(loadWorkspace(userId));
    }
  }, [userId]);

  const setWorkspace = useCallback((ws: Workspace) => {
    setWorkspaceState(ws);
    saveWorkspace(userId, ws);
  }, [userId]);

  const switchToPersonal = useCallback(() => {
    setWorkspace({ type: "personal" });
  }, [setWorkspace]);

  const switchToTeam = useCallback((teamId: string, teamName: string, role: TeamRole) => {
    setWorkspace({ type: "team", teamId, teamName, role });
  }, [setWorkspace]);

  /** Returns extra headers to include in API calls for team context. */
  const teamHeaders = useMemo((): Record<string, string> => {
    if (workspace.type === "team") {
      return { "x-team-id": workspace.teamId };
    }
    return {};
  }, [workspace]);

  const isTeam = workspace.type === "team";
  const isViewer = isTeam && (workspace as TeamWorkspace).role === "viewer";
  const isEditor = isTeam && ((workspace as TeamWorkspace).role === "editor" || (workspace as TeamWorkspace).role === "owner");
  const isOwner = isTeam && (workspace as TeamWorkspace).role === "owner";
  const canWrite = !isTeam || isEditor;

  return {
    workspace,
    setWorkspace,
    switchToPersonal,
    switchToTeam,
    teamHeaders,
    isTeam,
    isViewer,
    isEditor,
    isOwner,
    canWrite,
  };
}
