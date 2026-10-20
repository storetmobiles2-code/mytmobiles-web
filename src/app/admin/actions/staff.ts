"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { generateToken, sha256 } from "@/lib/auth/tokens";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { emailSchema } from "@/lib/validation";
import { sendStaffInviteEmail } from "@/lib/email/auth-emails";
import { applyStaffChange, StaffError } from "@/lib/admin/staff";
import { audit } from "@/lib/admin/audit";

type R = { ok?: string; error?: string };

const INVITE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const adminRole = z.enum(["STAFF", "ADMIN"]);

/** A one-time set-password link, using the password-reset token flow. */
async function sendInvite(user: { id: string; email: string; name: string }, role: "STAFF" | "ADMIN", invitedBy: string): Promise<boolean> {
  const token = generateToken();
  await db.authToken.deleteMany({ where: { userId: user.id, type: "PASSWORD_RESET", usedAt: null } });
  await db.authToken.create({ data: { id: sha256(token), userId: user.id, type: "PASSWORD_RESET", expiresAt: new Date(Date.now() + INVITE_TTL_MS) } });
  return sendStaffInviteEmail(user.email, user.name, token, ROLE_LABEL[role], invitedBy);
}

const NOT_SENT = " The invite email could not be sent (check email settings). Use “Resend invite” once email works.";

/** Adds a staff member by email: promotes an existing account, or creates one and emails a set-password link. */
export async function addStaffMember(_prev: R, fd: FormData): Promise<R> {
  const admin = await assertPermission("staff.manage");
  const email = emailSchema.safeParse(fd.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  const role = adminRole.safeParse(fd.get("role") ?? "STAFF");
  if (!role.success) return { error: "Choose a role." };
  const name = z.string().trim().max(80).parse(String(fd.get("name") ?? "")) || email.data.split("@")[0];

  const existing = await db.user.findUnique({ where: { email: email.data }, select: { id: true, role: true } });
  if (existing) {
    if (existing.role === role.data) return { error: `${email.data} is already ${ROLE_LABEL[role.data]}.` };
    try {
      await applyStaffChange(admin, existing.id, { kind: "role", to: role.data });
    } catch (err) {
      return { error: err instanceof StaffError ? err.message : "Couldn't change the role." };
    }
    revalidatePath("/admin/staff");
    return { ok: `${email.data} is now ${ROLE_LABEL[role.data]}. They need to sign in again.` };
  }

  // New account: an unguessable password nobody knows until the invite link is used.
  const user = await db.user.create({
    data: { email: email.data, name, role: role.data, passwordHash: await hashPassword(randomBytes(32).toString("base64url")) },
    select: { id: true, email: true, name: true },
  });
  await audit({
    actor: admin,
    action: "staff.added",
    entityType: "user",
    entityId: user.id,
    summary: `Added ${user.email} as ${ROLE_LABEL[role.data]} (new account, invite sent)`,
    changes: { role: { before: null, after: role.data } },
  });
  const sent = await sendInvite(user, role.data, admin.name);
  revalidatePath("/admin/staff");
  return { ok: `Account created for ${user.email}. We've emailed a link to set a password (valid for 3 days).${sent ? "" : NOT_SENT}` };
}

export async function changeStaffRole(userId: string, role: "CUSTOMER" | "STAFF" | "ADMIN"): Promise<R> {
  const admin = await assertPermission("staff.manage");
  const to = z.enum(["CUSTOMER", "STAFF", "ADMIN"]).safeParse(role);
  if (!to.success) return { error: "Choose a role." };
  try {
    const { email } = await applyStaffChange(admin, userId, { kind: "role", to: to.data });
    revalidatePath("/admin/staff");
    revalidatePath(`/admin/customers/${userId}`);
    return { ok: to.data === "CUSTOMER" ? `Admin access removed for ${email}.` : `${email} is now ${ROLE_LABEL[to.data]}.` };
  } catch (err) {
    return { error: err instanceof StaffError ? err.message : "Couldn't change the role." };
  }
}

export async function setStaffDisabled(userId: string, disabled: boolean): Promise<R> {
  const admin = await assertPermission("staff.manage");
  try {
    const { email } = await applyStaffChange(admin, userId, { kind: disabled ? "disable" : "enable" });
    revalidatePath("/admin/staff");
    return { ok: disabled ? `${email} is disabled and signed out.` : `${email} is enabled.` };
  } catch (err) {
    return { error: err instanceof StaffError ? err.message : "Couldn't update the account." };
  }
}

export async function resendStaffInvite(userId: string): Promise<R> {
  const admin = await assertPermission("staff.manage");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true, isDisabled: true } });
  if (!user || (user.role !== "STAFF" && user.role !== "ADMIN")) return { error: "Account not found." };
  if (user.isDisabled) return { error: "Enable the account first." };
  const sent = await sendInvite(user, user.role, admin.name);
  await audit({ actor: admin, action: "staff.invite_sent", entityType: "user", entityId: user.id, summary: `Sent a set-password link to ${user.email}` });
  return sent ? { ok: `Invite sent to ${user.email}.` } : { error: NOT_SENT.trim() };
}
