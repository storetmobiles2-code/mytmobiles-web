import { test as base, expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { totpCode, totpStep } from "../../src/lib/auth/totp";
import { STAFF_EMAIL, STAFF_PASSWORD } from "./accounts";

/** Product with plenty of stock in the seeded catalogue; override with E2E_PRODUCT_SLUG. */
export const PRODUCT_SLUG = process.env.E2E_PRODUCT_SLUG ?? "samsung-galaxy-a07-5g";
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
/** Authenticator secrets that global-setup enrols for the e2e admin and staff (2FA stays enforced in e2e). */
export const ADMIN_TOTP_SECRET = process.env.E2E_ADMIN_TOTP_SECRET ?? "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
export const STAFF_TOTP_SECRET = process.env.E2E_STAFF_TOTP_SECRET ?? "KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU";

/** Runs a query against the e2e database (the same DATABASE_URL the server under test uses). */
export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * A code the server will accept now. The server refuses a step it has already
 * seen (replay protection), so when the current step is used up, take the next
 * one (accepted as clock drift) or wait for it.
 */
export async function freshTotpCode(email: string, secret: string): Promise<string> {
  const last = await withDb(async (c) => {
    const r = await c.query<{ totpLastStep: number | null }>(`SELECT "totpLastStep" FROM "User" WHERE email = $1`, [email.toLowerCase()]);
    return r.rows[0]?.totpLastStep ?? null;
  });
  const step = Math.max(totpStep(), last === null ? 0 : last + 1);
  while (step > totpStep() + 1) await new Promise((r) => setTimeout(r, 1000));
  return totpCode(secret, step);
}

/** Signs in with email and password, then enters an authenticator code. */
export async function signIn(page: Page, { email, password, secret, next = "/admin" }: { email: string; password: string; secret: string; next?: string }) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/login\/verify/);
  await page.getByLabel("Code", { exact: true }).fill(await freshTotpCode(email, secret));
  await page.getByRole("button", { name: "Verify" }).click();
}

export async function signInAsAdmin(page: Page, next = "/admin") {
  await signIn(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, secret: ADMIN_TOTP_SECRET, next });
}

export async function signInAsStaff(page: Page, next = "/admin") {
  await signIn(page, { email: STAFF_EMAIL, password: STAFF_PASSWORD, secret: STAFF_TOTP_SECRET, next });
}
export { STAFF_EMAIL, STAFF_PASSWORD };

/** Fails any test whose page throws or logs a console error. */
export const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console: ${m.text()}`);
      });
      await use(errors);
      expect(errors, "browser errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
