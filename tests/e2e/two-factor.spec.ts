import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect, freshTotpCode, signIn, withDb } from "./fixtures";
import { totpCode, totpStep } from "../../src/lib/auth/totp";

/**
 * Admin two-factor sign-in: a new admin is sent to Security, enrols with the
 * setup key, then signs in with an app code and with a recovery code.
 * Creates a throwaway admin account and deletes it at the end.
 */
const email = `e2e-2fa+${Date.now()}@example.com`;
const password = "secret123A";
let secret = "";
let recoveryCodes: string[] = [];

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

async function passwordStep(page: Page) {
  await page.goto("/login?next=/admin");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/login\/verify/);
}

test.describe.serial("admin two-factor sign-in", () => {
  test.afterAll(async () => {
    await withDb((c) => c.query(`DELETE FROM "User" WHERE email = $1`, [email]));
  });

  test("a new admin must enrol before using the admin panel", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("E2E Two Factor");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel(/I agree/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/account/);
    await withDb((c) => c.query(`UPDATE "User" SET role = 'ADMIN' WHERE email = $1`, [email]));

    // Every admin page redirects to Security, and only Security is in the menu.
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/security$/);
    await expect(page.getByRole("heading", { name: "Security", level: 1 })).toBeVisible();
    await expect(page.getByText("Admin accounts must use two-factor sign-in")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Orders" })).toHaveCount(0);

    await page.getByRole("button", { name: "Set up two-factor sign-in" }).click();
    const key = page.getByTestId("totp-setup-key");
    await expect(key).toBeVisible();
    await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoAxeViolations(page);
    secret = (await key.textContent())!.replace(/\s/g, "");
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);

    // A wrong code is refused.
    const right = totpCode(secret, totpStep());
    await page.getByLabel("6-digit code from the app").fill(right === "123456" ? "654321" : "123456");
    await page.getByRole("button", { name: "Turn on two-factor sign-in" }).click();
    await expect(page.getByText("That code didn't work")).toBeVisible();

    await page.getByLabel("6-digit code from the app").fill(totpCode(secret, totpStep()));
    await page.getByRole("button", { name: "Turn on two-factor sign-in" }).click();
    await expect(page.getByText("Save your recovery codes now")).toBeVisible();
    recoveryCodes = await page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem").allTextContents();
    expect(recoveryCodes).toHaveLength(10);
    await page.getByRole("button", { name: "I've saved my codes" }).click();
    await expect(page.getByText("10 of 10 unused")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Orders" })).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await signOut(page);
  });

  test("signs in with an authenticator code; a wrong code shows an error", async ({ page }) => {
    await passwordStep(page);
    await page.waitForLoadState("networkidle");
    await expectNoAxeViolations(page);

    // No session yet: the admin panel still asks to sign in.
    const admin = await page.request.get("/admin", { maxRedirects: 0 });
    expect(admin.headers()["location"] ?? "").toContain("/login");

    await page.getByLabel("Code", { exact: true }).fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("That code didn't work")).toBeVisible();

    await page.getByLabel("Code", { exact: true }).fill(await freshTotpCode(email, secret));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await signOut(page);
  });

  test("signs in with a recovery code, which then stops working", async ({ page }) => {
    await passwordStep(page);
    await page.getByLabel("Code", { exact: true }).fill(recoveryCodes[0]);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.goto("/admin/security");
    await expect(page.getByText("9 of 10 unused")).toBeVisible();
    await signOut(page);

    await passwordStep(page);
    await page.getByLabel("Code", { exact: true }).fill(recoveryCodes[0]);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("That code didn't work")).toBeVisible();
    await page.getByLabel("Code", { exact: true }).fill(recoveryCodes[1]);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await signOut(page);
  });

  test("locks the code step after 5 wrong codes", async ({ page }) => {
    await passwordStep(page);
    // Wait for each answer: the error text from the previous try is still on screen.
    const tryCode = async (code: string) => {
      await page.getByLabel("Code", { exact: true }).fill(code);
      await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Verify" }).click()]);
    };
    for (let i = 0; i < 4; i++) {
      await tryCode("zzzz-zzzz-zzzz");
      await expect(page.getByText("That code didn't work")).toBeVisible();
    }
    await tryCode("zzzz-zzzz-zzzz");
    await expect(page.getByText("Too many wrong codes")).toBeVisible();

    // Even the right code is refused while locked.
    await signIn(page, { email, password, secret });
    await expect(page.getByText("Too many wrong codes")).toBeVisible();
  });
});
