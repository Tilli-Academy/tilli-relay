"use client";

import { useState, useRef, useEffect } from "react";
import type { Workspace, TeamRole } from "@/hooks/useWorkspace";

export interface TeamInfo {
  id: string;
  name: string;
  slug: string;
  role: TeamRole;
}

interface Props {
  workspace: Workspace;
  teams: TeamInfo[];
  onSwitchPersonal: () => void;
  onSwitchTeam: (teamId: string, teamName: string, role: TeamRole) => void;
  onManageTeams: () => void;
}

export default function WorkspaceSwitcher({
  workspace,
  teams,
  onSwitchPersonal,
  onSwitchTeam,
  onManageTeams,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentName = workspace.type === "personal"
    ? "Personal"
    : workspace.teamName;

  const currentRole = workspace.type === "team" ? workspace.role : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-content-secondary hover:bg-surface-secondary transition-colors w-full"
      >
        {workspace.type === "personal" ? (
          <svg className="w-3.5 h-3.5 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-tilli" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
        <span className="truncate">{currentName}</span>
        {currentRole && (
          <span className="ml-auto text-[10px] text-content-muted capitalize">{currentRole}</span>
        )}
        <svg className="w-3 h-3 text-content-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border-primary bg-surface-primary shadow-lg py-1">
          {/* Personal workspace */}
          <button
            onClick={() => {
              onSwitchPersonal();
              setOpen(false);
            }}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-surface-secondary transition-colors ${
              workspace.type === "personal" ? "text-tilli" : "text-content-secondary"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Personal</span>
            {workspace.type === "personal" && (
              <svg className="w-3 h-3 ml-auto text-tilli" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {teams.length > 0 && (
            <div className="border-t border-border-secondary my-1" />
          )}

          {/* Teams */}
          {teams.map((team) => {
            const isSelected = workspace.type === "team" && workspace.teamId === team.id;
            return (
              <button
                key={team.id}
                onClick={() => {
                  onSwitchTeam(team.id, team.name, team.role);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-surface-secondary transition-colors ${
                  isSelected ? "text-tilli" : "text-content-secondary"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{team.name}</span>
                <span className="ml-auto text-[10px] text-content-muted capitalize">{team.role}</span>
                {isSelected && (
                  <svg className="w-3 h-3 text-tilli flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}

          <div className="border-t border-border-secondary my-1" />

          <button
            onClick={() => {
              onManageTeams();
              setOpen(false);
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-content-tertiary hover:text-content-primary hover:bg-surface-secondary transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Manage Teams</span>
          </button>
        </div>
      )}
    </div>
  );
}
