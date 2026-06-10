"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { XIcon } from "@/components/Icons";
import { showToast } from "@/components/Toast/Toast";
import { api, authFetch } from "@/lib/apiBase";
import { TeamPanelProps, TeamListItem, TeamData } from "./types";
import TeamsListView from "./TeamsListView";
import TeamDetailView from "./TeamDetailView";

export default function TeamPanel({ open, onClose, workspace, onWorkspaceChange, onSwitchTeam, onSwitchPersonal }: TeamPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Navigation: null = teams list, string = team detail by ID
  const [viewingTeamId, setViewingTeamId] = useState<string | null>(null);

  // Teams list state
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Team detail state
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch teams list ──
  const fetchTeams = useCallback(async () => {
    setLoadingTeams(true);
    try {
      const res = await authFetch(api("/api/teams"), { cache: "no-store" });
      if (res.ok) setTeams(await res.json());
    } catch {}
    setLoadingTeams(false);
  }, []);

  // ── Fetch single team detail ──
  const fetchTeamDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await authFetch(api(`/api/teams/${id}`), { headers: { "x-team-id": id } });
      if (res.ok) setTeam(await res.json());
      else showToast("Failed to load team", "error");
    } catch {
      showToast("Failed to load team", "error");
    }
    setLoadingDetail(false);
  }, []);

  // Reset and load when panel opens
  useEffect(() => {
    if (open) {
      setViewingTeamId(null);
      setTeam(null);
      setShowCreateForm(false);
      setNewTeamName("");
      setConfirmDelete(false);
      fetchTeams();
    }
  }, [open, fetchTeams]);

  // Load detail when navigating to a team
  useEffect(() => {
    if (viewingTeamId) {
      setTeam(null);
      setEditingName(false);
      setInviteEmail("");
      setConfirmDelete(false);
      fetchTeamDetail(viewingTeamId);
    }
  }, [viewingTeamId, fetchTeamDetail]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (viewingTeamId) setViewingTeamId(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, viewingTeamId]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    },
    [onClose]
  );

  // ── Create team ──
  const handleCreate = useCallback(async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    try {
      const res = await authFetch(api("/api/teams"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      if (res.ok) {
        const newTeam = await res.json();
        showToast(`Team "${newTeam.name}" created`, "success");
        setNewTeamName("");
        setShowCreateForm(false);
        fetchTeams();
        onWorkspaceChange?.();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to create team", "error");
      }
    } catch {
      showToast("Failed to create team", "error");
    }
    setCreating(false);
  }, [newTeamName, fetchTeams, onWorkspaceChange]);

  // ── Rename team ──
  const handleSaveName = useCallback(async () => {
    if (!viewingTeamId || !nameInput.trim()) return;
    setSavingName(true);
    try {
      const res = await authFetch(api(`/api/teams/${viewingTeamId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-team-id": viewingTeamId },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      if (res.ok) {
        setEditingName(false);
        showToast("Team renamed", "success");
        fetchTeamDetail(viewingTeamId);
        fetchTeams();
        onWorkspaceChange?.();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to rename", "error");
      }
    } catch {
      showToast("Failed to rename", "error");
    }
    setSavingName(false);
  }, [viewingTeamId, nameInput, fetchTeamDetail, fetchTeams, onWorkspaceChange]);

  // ── Invite member ──
  const handleInvite = useCallback(async () => {
    if (!viewingTeamId || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await authFetch(api(`/api/teams/${viewingTeamId}/members`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-team-id": viewingTeamId },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (res.ok) {
        showToast(`Invited ${inviteEmail.trim()}`, "success");
        setInviteEmail("");
        setInviteRole("editor");
        fetchTeamDetail(viewingTeamId);
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to invite", "error");
      }
    } catch {
      showToast("Failed to invite", "error");
    }
    setInviting(false);
  }, [viewingTeamId, inviteEmail, inviteRole, fetchTeamDetail]);

  // ── Change role ──
  const handleChangeRole = useCallback(async (memberId: string, newRole: string) => {
    if (!viewingTeamId) return;
    setChangingRoleId(memberId);
    try {
      const res = await authFetch(api(`/api/teams/${viewingTeamId}/members/${memberId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-team-id": viewingTeamId },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        showToast("Role updated", "success");
        fetchTeamDetail(viewingTeamId);
        onWorkspaceChange?.();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to update role", "error");
      }
    } catch {
      showToast("Failed to update role", "error");
    }
    setChangingRoleId(null);
  }, [viewingTeamId, fetchTeamDetail, onWorkspaceChange]);

  // ── Remove member ──
  const handleRemoveMember = useCallback(async (memberId: string, email: string) => {
    if (!viewingTeamId) return;
    setRemovingId(memberId);
    try {
      const res = await authFetch(api(`/api/teams/${viewingTeamId}/members/${memberId}`), {
        method: "DELETE",
        headers: { "x-team-id": viewingTeamId },
      });
      if (res.ok) {
        showToast(`Removed ${email}`, "info");
        fetchTeamDetail(viewingTeamId);
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to remove", "error");
      }
    } catch {
      showToast("Failed to remove", "error");
    }
    setRemovingId(null);
  }, [viewingTeamId, fetchTeamDetail]);

  // ── Delete team ──
  const handleDeleteTeam = useCallback(async () => {
    if (!viewingTeamId) return;
    setDeleting(true);
    const wasActiveTeam = workspace.type === "team" && workspace.teamId === viewingTeamId;
    try {
      const res = await authFetch(api(`/api/teams/${viewingTeamId}`), {
        method: "DELETE",
        headers: { "x-team-id": viewingTeamId },
      });
      if (res.ok) {
        showToast("Team deleted", "info");
        setViewingTeamId(null);
        if (wasActiveTeam) {
          // Switch to personal workspace — the workspace change effect
          // in page.tsx will automatically re-fetch all data
          onSwitchPersonal?.();
        } else {
          // Not the active team, just refresh the teams list
          onWorkspaceChange?.();
        }
        fetchTeams();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to delete", "error");
      }
    } catch {
      showToast("Failed to delete", "error");
    }
    setDeleting(false);
    setConfirmDelete(false);
  }, [viewingTeamId, workspace, fetchTeams, onWorkspaceChange, onSwitchPersonal]);

  if (!open) return null;

  // Find role for the team being viewed
  const viewingTeamRole = teams.find((t) => t.id === viewingTeamId)?.role;
  const isOwnerOfViewed = viewingTeamRole === "owner";
  const isCurrentTeam = workspace.type === "team" && workspace.teamId === viewingTeamId;

  return (
    <div data-testid="team-panel-backdrop" className="fixed inset-0 z-50 flex justify-end bg-[var(--overlay-bg)]" onClick={handleBackdropClick}>
      <div
        ref={panelRef}
        data-testid="team-panel"
        className="flex h-full w-[440px] flex-col border-l border-border-primary bg-surface-primary shadow-xl animate-in slide-in-from-right"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border-secondary px-4 py-3">
          {viewingTeamId && (
            <button
              data-testid="team-panel-back"
              onClick={() => setViewingTeamId(null)}
              className="rounded p-1 text-content-tertiary transition-colors hover:bg-surface-secondary hover:text-content-primary"
              title="Back to all teams"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2 className="flex-1 text-sm font-semibold text-content-primary">
            {viewingTeamId ? (team?.name || "Team Settings") : "Manage Teams"}
          </h2>
          <button
            data-testid="team-panel-close"
            onClick={onClose}
            className="rounded p-1 text-content-muted transition-colors hover:bg-surface-secondary hover:text-content-secondary"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--scrollbar-thumb) var(--surface-primary)" }}>
          {!viewingTeamId ? (
            <TeamsListView
              teams={teams}
              loadingTeams={loadingTeams}
              showCreateForm={showCreateForm}
              newTeamName={newTeamName}
              creating={creating}
              workspace={workspace}
              onSetShowCreateForm={setShowCreateForm}
              onSetNewTeamName={setNewTeamName}
              onCreateTeam={handleCreate}
              onViewTeam={setViewingTeamId}
              onSwitchTeam={onSwitchTeam}
              onClose={onClose}
            />
          ) : (
            <TeamDetailView
              team={team}
              loadingDetail={loadingDetail}
              isCurrentTeam={isCurrentTeam}
              isOwnerOfViewed={isOwnerOfViewed}
              viewingTeamRole={viewingTeamRole}
              editingName={editingName}
              nameInput={nameInput}
              savingName={savingName}
              inviteEmail={inviteEmail}
              inviteRole={inviteRole}
              inviting={inviting}
              changingRoleId={changingRoleId}
              removingId={removingId}
              confirmDelete={confirmDelete}
              deleting={deleting}
              onSetEditingName={setEditingName}
              onSetNameInput={setNameInput}
              onSaveName={handleSaveName}
              onSetInviteEmail={setInviteEmail}
              onSetInviteRole={setInviteRole}
              onInvite={handleInvite}
              onChangeRole={handleChangeRole}
              onRemoveMember={handleRemoveMember}
              onSetConfirmDelete={setConfirmDelete}
              onDeleteTeam={handleDeleteTeam}
              onSwitchTeam={onSwitchTeam}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
