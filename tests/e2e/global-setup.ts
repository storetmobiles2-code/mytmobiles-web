import "dotenv/config";
import { randomBytes, scrypt } from "node:crypto";
import { Client } from "pg";
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
 * Also makes sure the STAFF test account exists with a known password.
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
  } finally {
    await client.end();
  }
}
