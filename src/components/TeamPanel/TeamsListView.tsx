"use client";

import { PlusIcon, ChevronRightIcon } from "@/components/Icons";
import { TeamListItem } from "./types";

interface TeamsListViewProps {
  teams: TeamListItem[];
  loadingTeams: boolean;
  showCreateForm: boolean;
  newTeamName: string;
  creating: boolean;
  workspace:
    | { type: "personal" }
    | { type: "team"; teamId: string; teamName: string; role: "owner" | "editor" | "viewer" };
  onSetShowCreateForm: (show: boolean) => void;
  onSetNewTeamName: (name: string) => void;
  onCreateTeam: () => void;
  onViewTeam: (id: string) => void;
  onSwitchTeam?: (teamId: string, teamName: string, role: "owner" | "editor" | "viewer") => void;
  onClose: () => void;
}

export default function TeamsListView({
  teams,
  loadingTeams,
  showCreateForm,
  newTeamName,
  creating,
  workspace,
  onSetShowCreateForm,
  onSetNewTeamName,
  onCreateTeam,
  onViewTeam,
  onSwitchTeam,
  onClose,
}: TeamsListViewProps) {
  return (
    <div className="p-4 space-y-4">
      {/* Create Team */}
      {!showCreateForm ? (
        <button
          data-testid="team-create-button"
          onClick={() => onSetShowCreateForm(true)}
          className="tilli-gradient flex w-full items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          <PlusIcon size={12} /> Create New Team
        </button>
      ) : (
        <div className="rounded-lg border border-border-primary bg-surface-tertiary p-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">New Team</p>
          <input
            data-testid="team-create-name-input"
            type="text"
            placeholder="Enter team name..."
            value={newTeamName}
            onChange={(e) => onSetNewTeamName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreateTeam();
              if (e.key === "Escape") { onSetShowCreateForm(false); onSetNewTeamName(""); }
            }}
            autoFocus
            className="w-full rounded border border-border-primary bg-surface-secondary px-2.5 py-1.5 text-xs text-content-primary placeholder-content-muted focus:border-tilli focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              data-testid="team-create-confirm"
              onClick={onCreateTeam}
              disabled={creating || !newTeamName.trim()}
              className="tilli-gradient flex-1 rounded px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              data-testid="team-create-cancel"
              onClick={() => { onSetShowCreateForm(false); onSetNewTeamName(""); }}
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
        <div data-testid="team-empty-state" className="rounded-lg border border-dashed border-border-primary p-6 text-center">
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
                data-testid={`team-list-item-${t.id}`}
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
                      <span data-testid={`team-active-badge-${t.id}`} className="shrink-0 rounded bg-tilli/20 px-1.5 py-0.5 text-[9px] font-semibold text-tilli">
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
                      data-testid={`team-switch-${t.id}`}
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
                    data-testid={`team-settings-${t.id}`}
                    onClick={() => onViewTeam(t.id)}
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
  );
}
