"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { XIcon, TrashIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";
import { showToast } from "@/components/Toast/Toast";
import { api } from "@/lib/apiBase";

interface TeamPanelProps {
  open: boolean;
  onClose: () => void;
  workspace:
    | { type: "personal" }
    | { type: "team"; teamId: string; teamName: string; role: "owner" | "editor" | "viewer" };
  onWorkspaceChange?: () => void;
  onSwitchTeam?: (teamId: string, teamName: string, role: "owner" | "editor" | "viewer") => void;
  onSwitchPersonal?: () => void;
}

interface TeamListItem {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "editor" | "viewer";
}

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
}

interface TeamData {
  id: string;
  name: string;
  slug: string;
  members: TeamMember[];
}

const ROLE_OPTIONS: Array<"owner" | "editor" | "viewer"> = ["owner", "editor", "viewer"];
const INVITE_ROLE_OPTIONS: Array<"editor" | "viewer"> = ["editor", "viewer"];

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
      const res = await fetch(api("/api/teams"), { cache: "no-store" });
      if (res.ok) setTeams(await res.json());
    } catch {}
    setLoadingTeams(false);
  }, []);

  // ── Fetch single team detail ──
  const fetchTeamDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(api(`/api/teams/${id}`), { headers: { "x-team-id": id } });
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
      const res = await fetch(api("/api/teams"), {
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
      const res = await fetch(api(`/api/teams/${viewingTeamId}`), {
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
      const res = await fetch(api(`/api/teams/${viewingTeamId}/members`), {
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
      const res = await fetch(api(`/api/teams/${viewingTeamId}/members/${memberId}`), {
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
      const res = await fetch(api(`/api/teams/${viewingTeamId}/members/${memberId}`), {
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
      const res = await fetch(api(`/api/teams/${viewingTeamId}`), {
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
    <div className="fixed inset-0 z-50 flex justify-end bg-[var(--overlay-bg)]" onClick={handleBackdropClick}>
      <div
        ref={panelRef}
        className="flex h-full w-[440px] flex-col border-l border-border-primary bg-surface-primary shadow-xl animate-in slide-in-from-right"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border-secondary px-4 py-3">
          {viewingTeamId && (
            <button
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
            onClick={onClose}
            className="rounded p-1 text-content-muted transition-colors hover:bg-surface-secondary hover:text-content-secondary"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--scrollbar-thumb) var(--surface-primary)" }}>
          {!viewingTeamId ? (
            /* ──────────── TEAMS LIST VIEW ──────────── */
            <div className="p-4 space-y-4">
              {/* Create Team */}
              {!showCreateForm ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="tilli-gradient flex w-full items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                >
                  <PlusIcon size={12} /> Create New Team
                </button>
              ) : (
                <div className="rounded-lg border border-border-primary bg-surface-tertiary p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">New Team</p>
                  <input
                    type="text"
                    placeholder="Enter team name..."
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") { setShowCreateForm(false); setNewTeamName(""); }
                    }}
                    autoFocus
                    className="w-full rounded border border-border-primary bg-surface-secondary px-2.5 py-1.5 text-xs text-content-primary placeholder-content-muted focus:border-tilli focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={creating || !newTeamName.trim()}
                      className="tilli-gradient flex-1 rounded px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {creating ? "Creating..." : "Create"}
                    </button>
                    <button
                      onClick={() => { setShowCreateForm(false); setNewTeamName(""); }}
                      className="rounded px-3 py-1.5 text-xs text-content-tertiary transition-colors hover:bg-surface-secondary hover:text-content-primary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Teams List */}
              {loadingTeams ? (
                <div className="py-8 text-center">
                  <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-border-primary border-t-tilli" />
                  <p className="mt-2 text-xs text-content-muted">Loading teams...</p>
                </div>
              ) : teams.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-primary p-6 text-center">
                  <svg className="mx-auto mb-2 h-10 w-10 text-content-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-xs text-content-tertiary">No teams yet</p>
                  <p className="mt-0.5 text-[10px] text-content-dim">Create your first team to start collaborating</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
                    Your Teams ({teams.length})
                  </p>
                  {teams.map((t) => {
                    const isCurrent = workspace.type === "team" && workspace.teamId === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                          isCurrent
                            ? "border-tilli/30 bg-tilli/5"
                            : "border-border-secondary hover:border-border-primary hover:bg-surface-tertiary"
                        }`}
                      >
                        {/* Team icon */}
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isCurrent ? "bg-tilli/20" : "bg-surface-secondary"}`}>
                          <svg className={`h-4 w-4 ${isCurrent ? "text-tilli" : "text-content-tertiary"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-medium text-content-primary">{t.name}</p>
                            {isCurrent && (
                              <span className="shrink-0 rounded bg-tilli/20 px-1.5 py-0.5 text-[9px] font-semibold text-tilli">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-content-muted capitalize">{t.role}</p>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!isCurrent && onSwitchTeam && (
                            <button
                              onClick={() => {
                                onSwitchTeam(t.id, t.name, t.role);
                                onClose();
                              }}
                              className="rounded bg-surface-secondary px-2.5 py-1 text-[11px] text-content-secondary transition-colors hover:bg-surface-secondary hover:text-content-primary"
                            >
                              Switch
                            </button>
                          )}
                          <button
                            onClick={() => setViewingTeamId(t.id)}
                            title="Team settings"
                            className="rounded p-1 text-content-muted transition-colors hover:bg-surface-secondary hover:text-content-primary"
                          >
                            <ChevronRightIcon size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ──────────── TEAM DETAIL VIEW ──────────── */
            <div className="p-4">
              {loadingDetail && !team ? (
                <div className="py-12 text-center">
                  <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-border-primary border-t-tilli" />
                  <p className="mt-2 text-xs text-content-muted">Loading team...</p>
                </div>
              ) : !team ? (
                <div className="py-12 text-center">
                  <p className="text-xs text-content-muted">Failed to load team.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Current team badge */}
                  {isCurrentTeam && (
                    <div className="flex items-center gap-2 rounded-lg bg-tilli/10 border border-tilli/20 px-3 py-2">
                      <div className="h-2 w-2 rounded-full bg-tilli animate-pulse" />
                      <p className="text-[11px] text-tilli">This is your active workspace</p>
                    </div>
                  )}
                  {!isCurrentTeam && onSwitchTeam && (
                    <button
                      onClick={() => {
                        onSwitchTeam(team.id, team.name, viewingTeamRole || "viewer");
                        onClose();
                      }}
                      className="tilli-gradient flex w-full items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                    >
                      Switch to this team
                    </button>
                  )}

                  {/* Team Name */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">Team Name</label>
                    {editingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveName();
                            if (e.key === "Escape") setEditingName(false);
                          }}
                          autoFocus
                          className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1.5 text-xs text-content-primary focus:border-tilli focus:outline-none"
                        />
                        <button onClick={handleSaveName} disabled={savingName || !nameInput.trim()} className="rounded bg-tilli px-2.5 py-1.5 text-xs font-medium text-white hover:bg-tilli-light disabled:opacity-50">
                          {savingName ? "..." : "Save"}
                        </button>
                        <button onClick={() => setEditingName(false)} className="rounded px-2 py-1.5 text-xs text-content-tertiary hover:bg-surface-secondary hover:text-content-primary">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-content-primary">{team.name}</span>
                        {isOwnerOfViewed && (
                          <button onClick={() => { setNameInput(team.name); setEditingName(true); }} className="rounded px-1.5 py-0.5 text-[11px] text-content-muted hover:bg-surface-secondary hover:text-content-secondary">
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Members */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
                      Members ({team.members.length})
                    </label>
                    <div className="space-y-1 rounded-lg border border-border-secondary p-2">
                      {team.members.map((member) => (
                        <div key={member.id} className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-surface-tertiary">
                          {/* Avatar */}
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-[10px] font-bold text-content-tertiary">
                            {member.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs text-content-primary">{member.email}</p>
                            <p className="text-[10px] text-content-dim">
                              Joined {new Date(member.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                          {/* Role */}
                          <div className="shrink-0">
                            {isOwnerOfViewed && member.role !== "owner" ? (
                              <select
                                value={member.role}
                                onChange={(e) => handleChangeRole(member.id, e.target.value)}
                                disabled={changingRoleId === member.id}
                                className="rounded border border-border-primary bg-surface-secondary px-1.5 py-0.5 text-[11px] text-content-primary focus:border-tilli focus:outline-none disabled:opacity-50"
                              >
                                {ROLE_OPTIONS.map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[11px] text-content-tertiary capitalize">{member.role}</span>
                            )}
                          </div>
                          {/* Remove */}
                          {isOwnerOfViewed && member.role !== "owner" && (
                            <button
                              onClick={() => handleRemoveMember(member.id, member.email)}
                              disabled={removingId === member.id}
                              title="Remove member"
                              className="shrink-0 rounded p-1 text-content-dim transition-colors hover:bg-surface-secondary hover:text-red-400 disabled:opacity-50"
                            >
                              <TrashIcon size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Invite Member */}
                  {isOwnerOfViewed && (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">Add Member</label>
                      <div className="rounded-lg border border-border-secondary p-3 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder="email@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
                            className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1.5 text-xs text-content-primary placeholder-content-muted focus:border-tilli focus:outline-none"
                          />
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                            className="rounded border border-border-primary bg-surface-secondary px-1.5 py-1.5 text-xs text-content-primary focus:border-tilli focus:outline-none"
                          >
                            {INVITE_ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={handleInvite}
                          disabled={inviting || !inviteEmail.trim()}
                          className="w-full rounded bg-tilli px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-tilli-light disabled:opacity-50"
                        >
                          {inviting ? "Adding..." : "Add to Team"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Danger Zone */}
                  {isOwnerOfViewed && (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-red-400/80">Danger Zone</label>
                      <div className="rounded-lg border border-red-900/30 p-3">
                        {confirmDelete ? (
                          <div className="space-y-2">
                            <p className="text-xs text-red-300/80">Permanently delete this team and all its data?</p>
                            <div className="flex gap-2">
                              <button onClick={handleDeleteTeam} disabled={deleting} className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50">
                                {deleting ? "Deleting..." : "Yes, delete"}
                              </button>
                              <button onClick={() => setConfirmDelete(false)} className="rounded px-3 py-1.5 text-xs text-content-tertiary hover:bg-surface-secondary">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs text-red-400/80 transition-colors hover:text-red-300">
                            <TrashIcon size={12} /> Delete this team
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
