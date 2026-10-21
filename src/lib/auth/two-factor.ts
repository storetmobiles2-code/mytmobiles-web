import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { generateToken, sha256 } from "./tokens";
import { SESSION_COOKIE, type SessionUser } from "./session";
import { verifyTotp } from "./totp";
import { lockKey } from "./two-factor-data";
import { decryptSecret, encryptSecret, generateRecoveryCodes, hashRecoveryCode, looksLikeRecoveryCode, parseEncryptionKey } from "./two-factor-crypto";

/**
 * Two-factor sign-in (TOTP) for admin accounts.
 *
 * - Sign-in: after a correct password, a user with 2FA on gets a 5-minute,
 *   single-use pending token (an AuthToken row + cookie) instead of a session,
 *   and finishes at /login/verify with an app code or a recovery code.
 * - Enforcement: every account that can open /admin must have 2FA on. Until it
 *   does, admin pages redirect to /admin/security and admin Server Actions
 *   refuse. Only ADMIN_2FA_ENFORCED=false turns this off, and only outside
 *   production.
 * - Brute force: 5 wrong codes lock the second step for 15 minutes (RateLimit table).
 */

export const SECURITY_PATH = "/admin/security";
export const PENDING_COOKIE = process.env.NODE_ENV === "production" ? "__Host-myt_2fa" : "myt_2fa";
const PENDING_TTL_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
export const ISSUER = "myT Mobiles";

// ───────── Configuration ─────────

let warnedIgnoredFlag = false;

export function twoFactorEnforced(): boolean {
  const e = env();
  if (e.ADMIN_2FA_ENFORCED?.trim().toLowerCase() !== "false") return true;
  if (e.NODE_ENV === "production") {
    if (!warnedIgnoredFlag) console.warn("ADMIN_2FA_ENFORCED=false is ignored in production. Admin two-factor sign-in stays required.");
    warnedIgnoredFlag = true;
    return true;
  }
  return false;
}

/** Throws a clear error if TOTP_ENCRYPTION_KEY is missing or malformed. Never falls back to another key. */
function encryptionKey(): Buffer {
  return parseEncryptionKey(env().TOTP_ENCRYPTION_KEY);
}

export function encryptionKeyProblem(): string | null {
  try {
    encryptionKey();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export function encryptTotpSecret(secret: string, userId: string): string {
  return encryptSecret(secret, encryptionKey(), userId);
}

export function decryptTotpSecret(stored: string, userId: string): string {
  return decryptSecret(stored, encryptionKey(), userId);
}

// ───────── Status and enforcement ─────────

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: Date | null;
  /** A secret was generated but not yet confirmed with a code. */
  pendingSetup: boolean;
  recoveryCodesLeft: number;
}

export const getTwoFactorStatus = cache(async (userId: string): Promise<TwoFactorStatus> => {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { totpEnabledAt: true, totpSecretEnc: true, _count: { select: { recoveryCodes: { where: { usedAt: null } } } } },
  });
  return {
    enabled: Boolean(u?.totpEnabledAt && u.totpSecretEnc),
    enabledAt: u?.totpEnabledAt ?? null,
    pendingSetup: Boolean(u && !u.totpEnabledAt && u.totpSecretEnc),
    recoveryCodesLeft: u?._count.recoveryCodes ?? 0,
  };
});

/** True when this admin must set up 2FA before using the rest of the admin panel. */
export async function twoFactorSetupRequired(userId: string): Promise<boolean> {
  return twoFactorEnforced() && !(await getTwoFactorStatus(userId)).enabled;
}

const exempt = new AsyncLocalStorage<boolean>();

/** Runs an admin guard without the 2FA requirement. Only for the actions that set 2FA up. */
export function withoutTwoFactorCheck<T>(fn: () => Promise<T>): Promise<T> {
  return exempt.run(true, fn);
}

export class TwoFactorRequiredError extends Error {
  constructor() {
    super("Set up two-factor sign-in (Admin → Security) before making changes.");
    this.name = "TwoFactorRequiredError";
  }
}

/**
 * Called by requireAdmin() ("page") and assertAdmin() ("action") once the
 * user is known to be an admin. Pages redirect to the Security page; actions throw.
 */
export async function enforceTwoFactor(user: SessionUser, mode: "page" | "action"): Promise<void> {
  if (exempt.getStore() || !(await twoFactorSetupRequired(user.id))) return;
  if (mode === "action") throw new TwoFactorRequiredError();
  // The page path comes from src/proxy.ts. Only page rendering is exempted by
  // path: Server Actions can be posted to any URL, so they never are.
  if ((await headers()).get("x-myt-pathname") === SECURITY_PATH) return;
  redirect(SECURITY_PATH);
}

// ───────── Code checks with lockout ─────────

export async function isTwoFactorLocked(userId: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ locked: boolean }[]>`
    SELECT ("count" >= ${MAX_FAILURES} AND "windowStart" > now() - make_interval(mins => ${LOCK_MINUTES}::int)) AS "locked"
    FROM "RateLimit" WHERE "key" = ${lockKey(userId)}`;
  return rows[0]?.locked ?? false;
}

/** Counts a wrong code. The 5th within 15 minutes starts a 15-minute lock. Returns true if now locked. */
async function recordFailure(userId: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${lockKey(userId)}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(mins => ${LOCK_MINUTES}::int)
                     THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(mins => ${LOCK_MINUTES}::int)
                             OR "RateLimit"."count" + 1 >= ${MAX_FAILURES}
                     THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  return (rows[0]?.count ?? 0) >= MAX_FAILURES;
}

async function clearFailures(userId: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key: lockKey(userId) } });
}

export type CodeCheck = "ok" | "invalid" | "locked";

export const CODE_MESSAGES: Record<Exclude<CodeCheck, "ok">, string> = {
  invalid: "That code didn't work. Check the time on your phone is correct and try again.",
  locked: `Too many wrong codes. Please try again in ${LOCK_MINUTES} minutes.`,
};

/** Accepts the step only if it is newer than the last used one, so a code works once. */
async function claimStep(userId: string, step: number): Promise<boolean> {
  const { count } = await db.user.updateMany({
    where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return count === 1;
}

async function consumeRecoveryCode(userId: string, input: string): Promise<boolean> {
  const { count } = await db.recoveryCode.updateMany({
    where: { userId, codeHash: hashRecoveryCode(input), usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

/**
 * Checks an authenticator code (or, if allowed, a recovery code) for a user
 * with 2FA on. Wrong codes count towards the lockout.
 */
export async function checkSecondFactor(userId: string, input: string, { allowRecovery = true } = {}): Promise<CodeCheck> {
  if (await isTwoFactorLocked(userId)) return "locked";
  const user = await db.user.findUnique({ where: { id: userId }, select: { totpSecretEnc: true, totpEnabledAt: true, totpLastStep: true } });
  if (!user?.totpSecretEnc || !user.totpEnabledAt) return "invalid";

  const code = input.trim();
  let ok = false;
  if (/^\d{3}\s?\d{3}$/.test(code)) {
    const step = verifyTotp(decryptTotpSecret(user.totpSecretEnc, userId), code, { lastStep: user.totpLastStep });
    ok = step !== null && (await claimStep(userId, step));
  } else if (allowRecovery && looksLikeRecoveryCode(code)) {
    ok = await consumeRecoveryCode(userId, code);
  }
  if (ok) {
    await clearFailures(userId);
    return "ok";
  }
  return (await recordFailure(userId)) ? "locked" : "invalid";
}

// ───────── Enrolment ─────────

/** Stores a new, unconfirmed secret. Refuses if 2FA is already on. */
export async function beginEnrolment(userId: string, secret: string): Promise<boolean> {
  const { count } = await db.user.updateMany({
    where: { id: userId, totpEnabledAt: null },
    data: { totpSecretEnc: encryptTotpSecret(secret, userId), totpLastStep: null },
  });
  return count === 1;
}

/** Decrypted secret of an enrolment in progress (for the QR code), or null. */
export async function pendingEnrolmentSecret(userId: string): Promise<string | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { totpSecretEnc: true, totpEnabledAt: true } });
  if (!u?.totpSecretEnc || u.totpEnabledAt) return null;
  return decryptTotpSecret(u.totpSecretEnc, userId);
}

/** Confirms enrolment with a first code. Returns the new recovery codes, or a failure. */
export async function confirmEnrolment(userId: string, code: string): Promise<{ codes: string[] } | { error: CodeCheck }> {
  if (await isTwoFactorLocked(userId)) return { error: "locked" };
  const secret = await pendingEnrolmentSecret(userId);
  const step = secret ? verifyTotp(secret, code) : null;
  if (step === null) return { error: (await recordFailure(userId)) ? "locked" : "invalid" };
  const { count } = await db.user.updateMany({
    where: { id: userId, totpEnabledAt: null },
    data: { totpEnabledAt: new Date(), totpLastStep: step },
  });
  if (count !== 1) return { error: "invalid" };
  await clearFailures(userId);
  await signOutOtherSessions(userId);
  return { codes: await replaceRecoveryCodes(userId) };
}

export async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })) }),
  ]);
  return codes;
}

/** Sessions opened before 2FA was on were made with a password alone; end them. */
async function signOutOtherSessions(userId: string): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await db.session.deleteMany({ where: { userId, ...(token ? { id: { not: sha256(token) } } : {}) } });
}

export { clearTwoFactor } from "./two-factor-data";

// ───────── Pending sign-in (between password and code) ─────────

export function twoFactorRequiredAtSignIn(user: { totpEnabledAt: Date | null; totpSecretEnc: string | null }): boolean {
  return Boolean(user.totpEnabledAt && user.totpSecretEnc);
}

/** Records that the password was correct and sets the short-lived pending cookie. */
export async function startPendingSignIn(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS);
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId, type: "TWO_FACTOR_PENDING" } }),
    db.authToken.create({ data: { id: sha256(token), userId, type: "TWO_FACTOR_PENDING", expiresAt } }),
  ]);
  (await cookies()).set(PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export interface PendingSignIn {
  tokenId: string;
  userId: string;
  email: string;
  role: SessionUser["role"];
}

export async function getPendingSignIn(): Promise<PendingSignIn | null> {
  const token = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!token) return null;
  const record = await db.authToken.findUnique({ where: { id: sha256(token) }, include: { user: { select: { email: true, role: true, isDisabled: true } } } });
  if (!record || record.type !== "TWO_FACTOR_PENDING" || record.usedAt || record.expiresAt < new Date() || record.user.isDisabled) return null;
  return { tokenId: record.id, userId: record.userId, email: record.user.email, role: record.user.role };
}

/** Marks the pending token used (once only) and clears its cookie. Returns false if it was already used or expired. */
export async function consumePendingSignIn(tokenId: string): Promise<boolean> {
  const { count } = await db.authToken.updateMany({
    where: { id: tokenId, type: "TWO_FACTOR_PENDING", usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  (await cookies()).delete(PENDING_COOKIE);
  return count === 1;
}

export async function clearPendingSignIn(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(PENDING_COOKIE)?.value;
  if (token) await db.authToken.deleteMany({ where: { id: sha256(token), type: "TWO_FACTOR_PENDING" } });
  jar.delete(PENDING_COOKIE);
}
