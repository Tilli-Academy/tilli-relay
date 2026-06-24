"use client";

import { TrashIcon } from "@/components/Icons";
import { TeamData, ROLE_OPTIONS, INVITE_ROLE_OPTIONS } from "./types";

interface TeamDetailViewProps {
  team: TeamData | null;
  loadingDetail: boolean;
  isCurrentTeam: boolean;
  isOwnerOfViewed: boolean;
  viewingTeamRole: "owner" | "editor" | "viewer" | undefined;
  editingName: boolean;
  nameInput: string;
  savingName: boolean;
  inviteEmail: string;
  inviteRole: "editor" | "viewer";
  inviting: boolean;
  changingRoleId: string | null;
  removingId: string | null;
  confirmDelete: boolean;
  deleting: boolean;
  onSetEditingName: (editing: boolean) => void;
  onSetNameInput: (name: string) => void;
  onSaveName: () => void;
  onSetInviteEmail: (email: string) => void;
  onSetInviteRole: (role: "editor" | "viewer") => void;
  onInvite: () => void;
  onChangeRole: (memberId: string, newRole: string) => void;
  onRemoveMember: (memberId: string, email: string) => void;
  onSetConfirmDelete: (confirm: boolean) => void;
  onDeleteTeam: () => void;
  onSwitchTeam?: (teamId: string, teamName: string, role: "owner" | "editor" | "viewer") => void;
  onClose: () => void;
}

export default function TeamDetailView({
  team,
  loadingDetail,
  isCurrentTeam,
  isOwnerOfViewed,
  viewingTeamRole,
  editingName,
  nameInput,
  savingName,
  inviteEmail,
  inviteRole,
  inviting,
  changingRoleId,
  removingId,
  confirmDelete,
  deleting,
  onSetEditingName,
  onSetNameInput,
  onSaveName,
  onSetInviteEmail,
  onSetInviteRole,
  onInvite,
  onChangeRole,
  onRemoveMember,
  onSetConfirmDelete,
  onDeleteTeam,
  onSwitchTeam,
  onClose,
}: TeamDetailViewProps) {
  return (
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
            <div data-testid="team-current-badge" className="flex items-center gap-2 rounded-lg bg-tilli/10 border border-tilli/20 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-tilli animate-pulse" />
              <p className="text-[11px] text-tilli">This is your active workspace</p>
            </div>
          )}
          {!isCurrentTeam && onSwitchTeam && (
            <button
              data-testid="team-switch-to-button"
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
                  data-testid="team-name-input"
                  type="text"
                  value={nameInput}
                  onChange={(e) => onSetNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSaveName();
                    if (e.key === "Escape") onSetEditingName(false);
                  }}
                  autoFocus
                  className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1.5 text-xs text-content-primary focus:border-tilli focus:outline-none"
                />
                <button data-testid="team-name-save" onClick={onSaveName} disabled={savingName || !nameInput.trim()} className="rounded bg-tilli px-2.5 py-1.5 text-xs font-medium text-white hover:bg-tilli-light disabled:opacity-50">
                  {savingName ? "..." : "Save"}
                </button>
                <button onClick={() => onSetEditingName(false)} className="rounded px-2 py-1.5 text-xs text-content-tertiary hover:bg-surface-secondary hover:text-content-primary">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span data-testid="team-name-display" className="text-sm font-medium text-content-primary">{team.name}</span>
                {isOwnerOfViewed && (
                  <button data-testid="team-name-edit-button" onClick={() => { onSetNameInput(team.name); onSetEditingName(true); }} className="rounded px-1.5 py-0.5 text-[11px] text-content-muted hover:bg-surface-secondary hover:text-content-secondary">
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
                <div key={member.id} data-testid={`team-member-${member.id}`} className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-surface-tertiary">
                  {/* Avatar */}
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-[10px] font-bold text-content-tertiary">
                    {member.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p data-testid={`team-member-email-${member.id}`} className="truncate text-xs text-content-primary">{member.email}</p>
                    <p className="text-[10px] text-content-dim">
                      Joined {new Date(member.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  {/* Role */}
                  <div className="shrink-0">
                    {isOwnerOfViewed && member.role !== "owner" ? (
                      <select
                        data-testid={`team-member-role-${member.id}`}
                        value={member.role}
                        onChange={(e) => onChangeRole(member.id, e.target.value)}
                        disabled={changingRoleId === member.id}
                        className="rounded border border-border-primary bg-surface-secondary px-1.5 py-0.5 text-[11px] text-content-primary focus:border-tilli focus:outline-none disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span data-testid={`team-member-role-${member.id}`} className="rounded bg-surface-secondary px-1.5 py-0.5 text-[11px] text-content-tertiary capitalize">{member.role}</span>
                    )}
                  </div>
                  {/* Remove */}
                  {isOwnerOfViewed && member.role !== "owner" && (
                    <button
                      data-testid={`team-member-remove-${member.id}`}
                      onClick={() => onRemoveMember(member.id, member.email)}
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
                    data-testid="team-invite-email"
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => onSetInviteEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") onInvite(); }}
                    className="flex-1 rounded border border-border-primary bg-surface-secondary px-2 py-1.5 text-xs text-content-primary placeholder-content-muted focus:border-tilli focus:outline-none"
                  />
                  <select
                    data-testid="team-invite-role"
                    value={inviteRole}
                    onChange={(e) => onSetInviteRole(e.target.value as "editor" | "viewer")}
                    className="rounded border border-border-primary bg-surface-secondary px-1.5 py-1.5 text-xs text-content-primary focus:border-tilli focus:outline-none"
                  >
                    {INVITE_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <button
                  data-testid="team-invite-submit"
                  onClick={onInvite}
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
                      <button data-testid="team-delete-confirm" onClick={onDeleteTeam} disabled={deleting} className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50">
                        {deleting ? "Deleting..." : "Yes, delete"}
                      </button>
                      <button data-testid="team-delete-cancel" onClick={() => onSetConfirmDelete(false)} className="rounded px-3 py-1.5 text-xs text-content-tertiary hover:bg-surface-secondary">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button data-testid="team-delete-trigger" onClick={() => onSetConfirmDelete(true)} className="flex items-center gap-1.5 text-xs text-red-400/80 transition-colors hover:text-red-300">
                    <TrashIcon size={12} /> Delete this team
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
