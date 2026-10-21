import "server-only";
import { db } from "@/lib/db";

/**
 * Database-only parts of two-factor sign-in, kept free of Next.js request APIs
 * so scripts/reset-2fa.ts can use them. The rest is in ./two-factor.ts.
 */

/** RateLimit key that counts wrong codes for the lockout. */
export const lockKey = (userId: string) => `2fa:${userId}`;

/** Turns 2FA off and removes the secret, recovery codes, any pending sign-in and the wrong-code lock. */
export async function clearTwoFactor(userId: string): Promise<void> {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null } }),
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.authToken.deleteMany({ where: { userId, type: "TWO_FACTOR_PENDING" } }),
    db.rateLimit.deleteMany({ where: { key: lockKey(userId) } }),
  ]);
}
