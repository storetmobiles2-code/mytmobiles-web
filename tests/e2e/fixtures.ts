import { test as base, expect } from "@playwright/test";

/** Product with plenty of stock in the seeded catalogue; override with E2E_PRODUCT_SLUG. */
export const PRODUCT_SLUG = process.env.E2E_PRODUCT_SLUG ?? "samsung-galaxy-a07-5g";
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";

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
