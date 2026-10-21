import "dotenv/config";
import { randomBytes, scrypt } from "node:crypto";
import { Client } from "pg";
import { encryptSecret, parseEncryptionKey } from "../../src/lib/auth/two-factor-crypto";
import { ADMIN_EMAIL, ADMIN_TOTP_SECRET, STAFF_TOTP_SECRET } from "./fixtures";
import { STAFF_EMAIL, STAFF_PASSWORD } from "./accounts";

/** Same format as src/lib/auth/password.ts (scrypt$N$r$p$salt$hash). */
function hashPassword(password: string): Promise<string> {
  const N = 131072, r = 8, p = 1;
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$")),
    ),
  );
}

/**
 * Repeated local runs come from one IP and would trip the sign-up/login rate
 * limits. E2E runs only against a disposable database, so clear them first.
 *
 * Also makes sure the STAFF test account exists with a known password.
 * Admin two-factor sign-in stays enforced in e2e: the e2e admin and staff are
 * enrolled here with known secrets, and the sign-in helper computes codes.
 */
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) return;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "RateLimit"`);
    await client.query(
      `INSERT INTO "User" (id, email, name, "passwordHash", role, "emailVerifiedAt", "updatedAt", "lastLoginAt")
       VALUES ('ce2estaffuser000000000001', $1, 'E2E Staff', $2, 'STAFF', now(), now(), now())
       ON CONFLICT (email) DO UPDATE SET role = 'STAFF', "isDisabled" = false, "passwordHash" = EXCLUDED."passwordHash"`,
      [STAFF_EMAIL, await hashPassword(STAFF_PASSWORD)],
    );
    const key = parseEncryptionKey(process.env.TOTP_ENCRYPTION_KEY); // must be the server's key
    for (const [email, secret] of [[ADMIN_EMAIL, ADMIN_TOTP_SECRET], [STAFF_EMAIL, STAFF_TOTP_SECRET]]) {
      if (!email) continue;
      const { rows } = await client.query<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [email.toLowerCase()]);
      if (rows[0]) {
        await client.query(`UPDATE "User" SET "totpSecretEnc" = $1, "totpEnabledAt" = now(), "totpLastStep" = NULL WHERE id = $2`, [
          encryptSecret(secret, key, rows[0].id),
          rows[0].id,
        ]);
      }
    }
  } finally {
    await client.end();
  }
}
