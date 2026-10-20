import "server-only";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { destroyAllSessions } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { staffChangeError, type StaffChange } from "@/lib/auth/staff-rules";
import { audit } from "./audit";

export class StaffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffError";
  }
}

/**
 * Changes a user's role or disables/enables the account, enforcing the
 * self-change and last-admin rules. Admin rows are locked for the check so
 * two admins demoting each other at the same moment can't both succeed.
 */
export async function applyStaffChange(actor: SessionUser, targetId: string, change: StaffChange): Promise<{ email: string; changed: boolean }> {
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE role = 'ADMIN' AND "isDisabled" = false FOR UPDATE`;
    const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, email: true, role: true, isDisabled: true } });
    if (!target) throw new StaffError("Account not found.");
    const activeAdmins = await tx.user.count({ where: { role: "ADMIN", isDisabled: false } });
    const error = staffChangeError({ actorId: actor.id, target, change, activeAdmins });
    if (error) throw new StaffError(error);
    const data = change.kind === "role" ? { role: change.to } : { isDisabled: change.kind === "disable" };
    const noop = change.kind === "role" ? target.role === change.to : target.isDisabled === (change.kind === "disable");
    if (noop) return { target, changed: false };
    await tx.user.update({ where: { id: target.id }, data });
    return { target, changed: true };
  });
  const { target, changed } = result;
  if (!changed) return { email: target.email, changed };
  // Sign the account out everywhere so the new access applies at once.
  if (change.kind !== "enable") await destroyAllSessions(target.id);
  if (change.kind === "role") {
    await audit({
      actor,
      action: "staff.role_changed",
      entityType: "user",
      entityId: target.id,
      summary: `${target.email}: ${ROLE_LABEL[target.role]} → ${ROLE_LABEL[change.to]}`,
      changes: { role: { before: target.role, after: change.to } },
    });
  } else {
    const disabled = change.kind === "disable";
    await audit({
      actor,
      action: disabled ? "user.disabled" : "user.enabled",
      entityType: "user",
      entityId: target.id,
      summary: `${disabled ? "Disabled" : "Enabled"} ${target.email} (${ROLE_LABEL[target.role]})`,
      changes: { isDisabled: { before: !disabled, after: disabled } },
    });
  }
  return { email: target.email, changed };
}
