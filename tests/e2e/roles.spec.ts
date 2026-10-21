import AxeBuilder from "@axe-core/playwright";
import { Client } from "pg";
import type { Page } from "@playwright/test";
import { test, expect, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_TOTP_SECRET, PRODUCT_SLUG, STAFF_EMAIL, STAFF_PASSWORD, STAFF_TOTP_SECRET, signIn as signInWith2fa } from "./fixtures";

/**
 * Staff roles and the admin audit log. Writes to the database directly to
 * set up an order, so run only against a disposable, seeded database.
 */

async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

async function signIn(page: Page, email: string, password: string) {
  await signInWith2fa(page, { email, password, secret: email === STAFF_EMAIL ? STAFF_TOTP_SECRET : ADMIN_TOTP_SECRET });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

/** A confirmed COD order, ready to pack. */
async function createConfirmedOrder(): Promise<{ id: string; orderNumber: string }> {
  const id = `ce2eorder${Date.now()}`;
  const orderNumber = `MYT-E2E-${Date.now().toString(36).toUpperCase()}`;
  await withDb(async (db) => {
    const { rows } = await db.query(`SELECT id FROM "User" WHERE email = $1`, [STAFF_EMAIL]);
    await db.query(
      `INSERT INTO "Order" (id, "orderNumber", "userId", status, "paymentMethod", "paymentStatus", email, "shipName", "shipPhone", "shipLine1", "shipCity", "shipState", "shipPincode",
         "mrpTotal", subtotal, total, "taxableValue", "isInterState", "updatedAt")
       VALUES ($1, $2, $3, 'CONFIRMED', 'COD', 'PENDING', 'buyer@example.com', 'E2E Buyer', '9876543210', 'Flat 1, Test Road', 'Hyderabad', 'Telangana', '500081',
         100000, 100000, 100000, 84746, false, now())`,
      [id, orderNumber, rows[0].id],
    );
  });
  return { id, orderNumber };
}

const productId = (slug: string) => withDb(async (db) => (await db.query(`SELECT id FROM "Product" WHERE slug = $1`, [slug])).rows[0].id as string);

test.describe("staff role", () => {
  test.skip(!process.env.DATABASE_URL, "Needs DATABASE_URL for the test staff account");

  test("staff can move an order along but can't open settings or edit products", async ({ page, browserErrors }) => {
    const order = await createConfirmedOrder();
    await signIn(page, STAFF_EMAIL, STAFF_PASSWORD);

    // Navigation shows only what staff may use.
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();
    for (const hidden of ["Settings", "Coupons", "Staff", "Activity", "Analytics", "Customers"]) await expect(nav.getByRole("link", { name: hidden })).toHaveCount(0);
    await expect(page.getByText("Last 30 days", { exact: true })).toHaveCount(0);

    // Orders: status and shipping details.
    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByRole("heading", { name: new RegExp(order.orderNumber) })).toBeVisible();
    await expect(page.getByRole("link", { name: "Packing slip" })).toBeVisible();
    await page.getByRole("button", { name: "Mark packed" }).click();
    await expect(page.getByText("Order moved to packed.")).toBeVisible();
    await page.getByLabel("Courier name").fill("Delhivery");
    await page.getByLabel("Tracking number").fill("STAFF123");
    await page.getByRole("button", { name: "Mark shipped" }).click();
    await expect(page.getByText("Order moved to shipped.")).toBeVisible();
    const status = await withDb(async (db) => (await db.query(`SELECT status, "trackingNumber" FROM "Order" WHERE id = $1`, [order.id])).rows[0]);
    expect(status).toEqual({ status: "SHIPPED", trackingNumber: "STAFF123" });

    // Packing slip opens for staff.
    await page.goto(`/packing-slip/${order.id}`);
    await expect(page.getByRole("heading", { name: "PACKING SLIP" })).toBeVisible();

    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New product" })).toHaveCount(0);

    // Owner-only pages show "no access" instead of crashing.
    for (const path of ["/admin/settings", "/admin/products/new", "/admin/coupons", "/admin/staff", "/admin/activity"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "You don't have access to this" }), path).toBeVisible();
    }

    // Products are view-only.
    const pid = await productId(PRODUCT_SLUG);
    await page.goto(`/admin/products/${pid}`);
    await expect(page.getByText(/View only/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" }).first()).toBeDisabled();

    // Calling the server action anyway (by re-enabling the form in the browser) is refused on the server.
    const before = await withDb(async (db) => (await db.query(`SELECT v.id, v.price FROM "ProductVariant" v WHERE v."productId" = $1 ORDER BY v."sortOrder", v.price LIMIT 1`, [pid])).rows[0]);
    await page.locator("fieldset[disabled]").evaluate((el) => el.removeAttribute("disabled"));
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("Price (₹)").fill("1");
    const response = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
    await page.getByRole("button", { name: "Save variant" }).click();
    expect((await response).status()).toBeGreaterThanOrEqual(400);
    const after = await withDb(async (db) => (await db.query(`SELECT price FROM "ProductVariant" WHERE id = $1`, [before.id])).rows[0]);
    expect(after.price).toBe(before.price);
    const staffAudit = await withDb(async (db) => (await db.query(`SELECT action FROM "AuditLog" WHERE "actorEmail" = $1 AND "entityType" = 'product'`, [STAFF_EMAIL])).rows);
    expect(staffAudit).toEqual([]);

    // The status changes were recorded against the staff member.
    const orderAudit = await withDb(async (db) => (await db.query(`SELECT action, changes FROM "AuditLog" WHERE "entityId" = $1 ORDER BY "createdAt"`, [order.id])).rows);
    expect(orderAudit.map((r) => r.action)).toEqual(["order.status_changed", "order.status_changed"]);
    expect(orderAudit[1].changes.trackingNumber).toEqual({ before: null, after: "STAFF123" });
    // The refused server-action call surfaces as a browser error (React #441 / HTTP 500); that one is expected.
    browserErrors.splice(0, browserErrors.length, ...browserErrors.filter((e) => !/#441|access|status of 500|Server Components render|digest/i.test(e)));
  });
});

test.describe("admin audit log", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD || !process.env.DATABASE_URL, "Set ADMIN_EMAIL/ADMIN_PASSWORD and DATABASE_URL");

  test("a price change shows in Activity with before and after", async ({ page }) => {
    const target = await withDb(async (db) =>
      (await db.query(
        `SELECT p.id, v.sku, v.price FROM "Product" p JOIN "ProductVariant" v ON v."productId" = p.id
         WHERE p."isActive" AND p.slug <> $1 AND v.price > 100 ORDER BY p.slug, v."sortOrder", v.price LIMIT 1`,
        [PRODUCT_SLUG],
      )).rows[0],
    );
    const newPrice = target.price - 100; // ₹1 less, so it stays at or under MRP
    const rs = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/admin/products/${target.id}`);
    const row = page.getByRole("row").filter({ hasText: target.sku });
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Price (₹)").fill(String(newPrice / 100));
    await page.getByRole("button", { name: "Save variant" }).click();
    await expect(page.getByRole("row").filter({ hasText: target.sku }).getByText(rs(newPrice))).toBeVisible();

    // The product's own History panel shows it.
    const history = page.locator("section").filter({ has: page.getByRole("heading", { name: "History", exact: true }) });
    await expect(history.getByText(`${rs(target.price)} → ${rs(newPrice)}`).first()).toBeVisible();

    await page.goto(`/admin/activity?action=product.price_changed`);
    const entry = page.getByRole("row").filter({ hasText: target.sku }).first();
    await expect(entry).toContainText(ADMIN_EMAIL);
    await expect(entry).toContainText(`${target.sku}.price`);
    await expect(entry).toContainText(`${rs(target.price)} → ${rs(newPrice)}`);
    await entry.getByRole("link", { name: "Open product" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/products/${target.id}$`));

    // Filters: by person and by entity.
    await page.goto(`/admin/activity?actor=${encodeURIComponent(ADMIN_EMAIL)}&entity=product&entityId=${target.id}`);
    await expect(page.getByRole("row").filter({ hasText: target.sku }).first()).toBeVisible();
  });

  test("staff and activity pages pass WCAG A/AA checks", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const path of ["/admin/staff", "/admin/activity"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(violations.map((v) => `${path} ${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    }
  });

  test("staff page lists the test staff member and protects the last admin", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin/staff");
    await expect(page.getByRole("row").filter({ hasText: STAFF_EMAIL })).toContainText("Staff");
    await expect(page.getByRole("row").filter({ hasText: ADMIN_EMAIL })).toContainText("You can't change your own access.");
  });
});

test("no-access page passes WCAG A/AA checks", async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, "Needs the test staff account");
  await signIn(page, STAFF_EMAIL, STAFF_PASSWORD);
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
});
