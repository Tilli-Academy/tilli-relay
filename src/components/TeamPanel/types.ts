export interface TeamPanelProps {
  open: boolean;
  onClose: () => void;
  workspace:
    | { type: "personal" }
    | { type: "team"; teamId: string; teamName: string; role: "owner" | "editor" | "viewer" };
  onWorkspaceChange?: () => void;
  onSwitchTeam?: (teamId: string, teamName: string, role: "owner" | "editor" | "viewer") => void;
  onSwitchPersonal?: () => void;
}

export interface TeamListItem {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "editor" | "viewer";
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
}

export interface TeamData {
  id: string;
  name: string;
  slug: string;
  members: TeamMember[];
}

export const ROLE_OPTIONS: Array<"owner" | "editor" | "viewer"> = ["owner", "editor", "viewer"];
export const INVITE_ROLE_OPTIONS: Array<"editor" | "viewer"> = ["editor", "viewer"];
