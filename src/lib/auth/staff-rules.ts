/**
 * Rules for changing who can use the admin. Pure, so they are unit-tested.
 *
 * - Nobody can change their own role or disable themself (an admin could
 *   otherwise lock the store out by accident).
 * - The last active ADMIN can never be demoted or disabled.
 */
import type { Role } from "@/generated/prisma/enums";

export type StaffChange = { kind: "role"; to: Role } | { kind: "disable" } | { kind: "enable" };

export interface StaffChangeInput {
  actorId: string;
  target: { id: string; role: Role; isDisabled: boolean };
  change: StaffChange;
  /** Active (not disabled) ADMIN accounts, including the target */
  activeAdmins: number;
}

/** Returns why the change isn't allowed, or null when it is. */
export function staffChangeError({ actorId, target, change, activeAdmins }: StaffChangeInput): string | null {
  const self = target.id === actorId;
  if (change.kind === "role") {
    if (change.to === target.role) return null;
    if (self) return "You can't change your own role.";
  }
  if (change.kind === "disable") {
    if (target.isDisabled) return null;
    if (self) return "You can't disable your own account.";
  }
  if (change.kind === "enable") return null;
  const removesActiveAdmin = target.role === "ADMIN" && !target.isDisabled;
  if (removesActiveAdmin && activeAdmins <= 1) return "This is the last active admin. Make someone else an admin first.";
  return null;
}
