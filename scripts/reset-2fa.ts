/**
 * Clears two-factor sign-in for a locked-out admin (lost phone and recovery codes).
 * For the store owner only.
 *
 *   npm run auth:reset-2fa -- <email>
 *
 * Removes the authenticator secret, recovery codes, any pending sign-in and the
 * wrong-code lock, and signs the account out everywhere. While 2FA is enforced,
 * the admin must set it up again at Admin → Security right after signing in.
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { clearTwoFactor } from "@/lib/auth/two-factor-data";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || email.startsWith("-")) {
    console.error("Usage: npm run auth:reset-2fa -- <email>");
    process.exit(1);
  }
  const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true, totpEnabledAt: true, totpSecretEnc: true } });
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }

  console.warn(
    [
      "",
      "WARNING: this turns off two-factor sign-in for this account.",
      "Do it only after confirming in person or by phone that the request is genuine.",
      "Anyone who knows the password can then sign in with the password alone until 2FA is set up again.",
      "",
    ].join("\n"),
  );
  if (!user.totpEnabledAt && !user.totpSecretEnc) console.log(`${email} does not have two-factor sign-in on. Clearing anything left over.`);

  await clearTwoFactor(user.id);
  const { count } = await db.session.deleteMany({ where: { userId: user.id } });
  console.log(`Two-factor sign-in reset for ${email} (${user.role}). Signed out of ${count} session(s).`);
  console.log("Ask them to sign in and set it up again at Admin → Security.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
