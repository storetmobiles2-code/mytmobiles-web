import "dotenv/config";
import { Client } from "pg";
import { encryptSecret, parseEncryptionKey } from "../../src/lib/auth/two-factor-crypto";
import { ADMIN_EMAIL, ADMIN_TOTP_SECRET } from "./fixtures";

/**
 * Repeated local runs come from one IP and would trip the sign-up/login rate
 * limits. E2E runs only against a disposable database, so clear them first.
 *
 * Admin two-factor sign-in stays enforced in e2e: the e2e admin is enrolled
 * here with a known secret, and the sign-in helper computes its codes.
 */
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) return;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "RateLimit"`);
    if (ADMIN_EMAIL) {
      const key = parseEncryptionKey(process.env.TOTP_ENCRYPTION_KEY); // must be the server's key
      const { rows } = await client.query<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [ADMIN_EMAIL.toLowerCase()]);
      if (rows[0]) {
        await client.query(`UPDATE "User" SET "totpSecretEnc" = $1, "totpEnabledAt" = now() WHERE id = $2`, [
          encryptSecret(ADMIN_TOTP_SECRET, key, rows[0].id),
          rows[0].id,
        ]);
      }
    }
  } finally {
    await client.end();
  }
}
