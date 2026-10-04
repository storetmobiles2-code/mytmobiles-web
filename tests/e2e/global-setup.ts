import "dotenv/config";
import { Client } from "pg";

/**
 * Repeated local runs come from one IP and would trip the sign-up/login rate
 * limits. E2E runs only against a disposable database, so clear them first.
 */
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) return;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "RateLimit"`);
  } finally {
    await client.end();
  }
}
