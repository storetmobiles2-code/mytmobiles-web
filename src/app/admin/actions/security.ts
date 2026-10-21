"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/auth/guards";
import { verifyPassword } from "@/lib/auth/password";
import { generateTotpSecret } from "@/lib/auth/totp";
import { rateLimit } from "@/lib/rate-limit";
import {
  beginEnrolment,
  checkSecondFactor,
  clearTwoFactor,
  CODE_MESSAGES,
  confirmEnrolment,
  getTwoFactorStatus,
  replaceRecoveryCodes,
  withoutTwoFactorCheck,
} from "@/lib/auth/two-factor";

export type SecurityState = { ok?: string; error?: string; codes?: string[] };

/** These actions are how an admin sets 2FA up, so they skip the "2FA required" check (but not the admin check). */
const admin = () => withoutTwoFactorCheck(() => assertAdmin());

export async function startTwoFactorSetup(): Promise<void> {
  const user = await admin();
  await beginEnrolment(user.id, generateTotpSecret());
  revalidatePath("/admin/security");
}

export async function confirmTwoFactorSetup(_prev: SecurityState, fd: FormData): Promise<SecurityState> {
  const user = await admin();
  const code = String(fd.get("code") ?? "").trim();
  if (!/^\d{3}\s?\d{3}$/.test(code)) return { error: "Enter the 6-digit code from your authenticator app." };
  const result = await confirmEnrolment(user.id, code);
  if ("error" in result) return { error: CODE_MESSAGES[result.error === "locked" ? "locked" : "invalid"] };
  // No revalidation here: the page would swap to the "on" view and hide the codes.
  // The form refreshes the page once the admin has saved them.
  return { ok: "Two-factor sign-in is on.", codes: result.codes };
}

export async function regenerateRecoveryCodes(_prev: SecurityState, fd: FormData): Promise<SecurityState> {
  const user = await admin();
  if (!(await getTwoFactorStatus(user.id)).enabled) return { error: "Two-factor sign-in is not on." };
  const result = await checkSecondFactor(user.id, String(fd.get("code") ?? ""));
  if (result !== "ok") return { error: CODE_MESSAGES[result] };
  return { ok: "New recovery codes created. The old ones no longer work.", codes: await replaceRecoveryCodes(user.id) };
}

export async function disableTwoFactor(_prev: SecurityState, fd: FormData): Promise<SecurityState> {
  const user = await admin();
  if (!(await rateLimit(`2fa-disable:${user.id}`, 5, 900))) return { error: "Too many attempts. Please wait 15 minutes." };
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(String(fd.get("password") ?? ""), record.passwordHash))) return { error: "Your password is incorrect." };
  const result = await checkSecondFactor(user.id, String(fd.get("code") ?? ""));
  if (result !== "ok") return { error: CODE_MESSAGES[result] };
  await clearTwoFactor(user.id);
  revalidatePath("/admin", "layout");
  return { ok: "Two-factor sign-in is off." };
}
