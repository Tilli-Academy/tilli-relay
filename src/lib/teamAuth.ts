import { db } from "./db";
import { teamMembers } from "./schema";
import { eq, and } from "drizzle-orm";

export type TeamRole = "owner" | "editor" | "viewer";

const ROLE_LEVEL: Record<TeamRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

/** Get a user's role in a team. Returns null if not a member. */
export async function getUserTeamRole(
  userId: string,
  teamId: string
): Promise<TeamRole | null> {
  const [member] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  return member ? (member.role as TeamRole) : null;
}

/**
 * Require that a user has at least `minimumRole` in the given team.
 * Throws an object with `status` and `error` if unauthorized.
 */
export async function requireTeamRole(
  userId: string,
  teamId: string,
  minimumRole: TeamRole
): Promise<TeamRole> {
  const role = await getUserTeamRole(userId, teamId);
  if (!role) {
    throw { status: 403, error: "Not a member of this team" };
  }
  if (ROLE_LEVEL[role] < ROLE_LEVEL[minimumRole]) {
    throw { status: 403, error: `Requires ${minimumRole} role or higher` };
  }
  return role;
}

/** Returns true if the role can create/update/delete resources. */
export function canWrite(role: TeamRole): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL.editor;
}

/** Returns true if the role can manage team settings and members. */
export function canManageTeam(role: TeamRole): boolean {
  return role === "owner";
}
