import { test, expect, PRODUCT_SLUG, signInAsAdmin, withDb } from "./fixtures";

/**
 * POS sync price gates: small changes apply, large/₹0/below-margin changes are
 * held for the owner, holds are approved or rejected (bot API and Admin), and a
 * sync's prices can be rolled back. Writes to one variant directly and restores
 * it afterwards, so run only against a disposable, seeded database.
 */
const POS = process.env.POS_SYNC_SECRET ?? "";
const HARNESS = process.env.HARNESS_SECRET ?? "";
const auth = (secret: string) => ({ Authorization: `Bearer ${secret}` });

type Variant = { id: string; sku: string; price: number; mrp: number; stock: number; name: string; slug: string };

test.describe("POS sync price gates", () => {
  test.skip(!POS || !HARNESS, "POS_SYNC_SECRET and HARNESS_SECRET must be set for the server and the tests");
  test.describe.configure({ mode: "serial" });

  let v: Variant;
  const itemId = `e2e-pos-${Date.now()}`;
  const rupees = (paise: number) => Math.round(paise / 100);

  test.beforeAll(async () => {
    v = await withDb(async (db) => {
      // A variant with one POS name and room under MRP, away from the checkout tests' product.
      const r = await db.query(
        `SELECT v.id, v.sku, v.price, v.mrp, v.stock, v."externalNames"[1] AS name, p.slug
           FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
          WHERE p."isActive" AND v."isActive" AND array_length(v."externalNames", 1) = 1
            AND p.slug <> $1 AND v.price >= 500000 AND v.mrp >= v.price * 1.1
          ORDER BY v.sku LIMIT 1`,
        [PRODUCT_SLUG],
      );
      return r.rows[0];
    });
    expect(v, "a seeded variant with a POS name and room under MRP").toBeTruthy();
  });

  test.afterAll(async () => {
    if (!v) return;
    await withDb(async (db) => {
      await db.query(`UPDATE "ProductVariant" SET price = $2, stock = $3 WHERE id = $1`, [v.id, v.price, v.stock]);
      await db.query(`DELETE FROM "PriceHold" WHERE "variantId" = $1`, [v.id]);
      await db.query(`DELETE FROM "PosStockItem" WHERE id = $1`, [itemId]);
    });
  });

  const sync = (request: import("@playwright/test").APIRequestContext, price: number, extra: Record<string, unknown> = {}) =>
    request.post("/api/sync/pos-stock", { headers: auth(POS), data: { items: [{ id: itemId, name: v.name, price, quantity: 3, category: "E2E", ...extra }] } });
  const dbPrice = () => withDb(async (db) => (await db.query(`SELECT price FROM "ProductVariant" WHERE id = $1`, [v.id])).rows[0].price as number);

  test("rejects requests without the right secret", async ({ request }) => {
    expect((await request.post("/api/sync/pos-stock", { headers: auth("x".repeat(40)), data: { items: [] } })).status()).toBe(401);
    expect((await request.get("/api/sync/held-prices", { headers: auth(POS) })).status()).toBe(401);
    expect((await request.post("/api/sync/held-prices/nope", { headers: auth(POS), data: { decision: "approve", approver: "e2e" } })).status()).toBe(401);
  });

  test("applies a small change and reports it for the canary", async ({ request }) => {
    const target = rupees(v.price * 1.05);
    const res = await sync(request, target);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.held).toEqual([]);
    expect(body.auditId).toBeTruthy();
    expect(body.changes).toContainEqual(expect.objectContaining({ sku: v.sku, slug: v.slug, price: target }));
    expect(await dbPrice()).toBe(target * 100);
  });

  let holdId = "";
  test("holds a change over 15% and doesn't duplicate it on resend", async ({ request }) => {
    const before = await dbPrice();
    const target = rupees(before * 0.7);
    const first = await (await sync(request, target)).json();
    expect(first.held).toHaveLength(1);
    expect(first.held[0]).toMatchObject({ sku: v.sku, reason: "large-change", priceAfter: target * 100 });
    holdId = first.held[0].id;
    expect(await dbPrice()).toBe(before);

    const again = await (await sync(request, target)).json();
    expect(again.held[0].id).toBe(holdId);
    const list = await (await request.get("/api/sync/held-prices", { headers: auth(HARNESS) })).json();
    expect(list.holds.filter((h: { sku: string }) => h.sku === v.sku)).toEqual([expect.objectContaining({ id: holdId, approvable: true, priceAfter: target })]);
  });

  test("shows held prices to the owner in Admin → Inventory", async ({ page }) => {
    await signInAsAdmin(page, "/admin/inventory");
    await expect(page.getByRole("heading", { name: /Held prices/ })).toBeVisible();
    await expect(page.getByText(v.sku).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" }).first()).toBeVisible();
  });

  test("approves a hold once", async ({ request }) => {
    const res = await request.post(`/api/sync/held-prices/${holdId}`, { headers: auth(HARNESS), data: { decision: "approve", approver: "discord:e2e" } });
    expect(res.ok()).toBe(true);
    const held = await withDb(async (db) => (await db.query(`SELECT "priceAfter", status, "decidedBy" FROM "PriceHold" WHERE id = $1`, [holdId])).rows[0]);
    expect(held).toMatchObject({ status: "APPROVED", decidedBy: "discord:e2e" });
    expect(await dbPrice()).toBe(held.priceAfter);
    const twice = await request.post(`/api/sync/held-prices/${holdId}`, { headers: auth(HARNESS), data: { decision: "approve", approver: "discord:e2e" } });
    expect(twice.status()).toBe(409);
  });

  test("rolls back a sync's prices, leaving later changes alone", async ({ request }) => {
    const before = await dbPrice();
    const target = rupees(before * 1.05);
    const { auditId } = await (await sync(request, target)).json();
    expect(await dbPrice()).toBe(target * 100);
    const r = await (await request.post("/api/sync/pos-stock/rollback", { headers: auth(POS), data: { auditId } })).json();
    expect(r).toMatchObject({ restored: 1, skipped: [] });
    expect(await dbPrice()).toBe(before);
    // Repeating it is harmless: the price is no longer the synced one.
    const again = await (await request.post("/api/sync/pos-stock/rollback", { headers: auth(POS), data: { auditId } })).json();
    expect(again).toMatchObject({ restored: 0, skipped: [v.sku] });
  });

  test("holds a price the shop flags as below its margin floor", async ({ request }) => {
    const before = await dbPrice();
    const body = await (await sync(request, rupees(before * 0.98), { holdPrice: "below-margin" })).json();
    expect(body.held[0]).toMatchObject({ sku: v.sku, reason: "below-margin" });
    expect(await dbPrice()).toBe(before);
  });

  test("a ₹0 POS price can only be rejected", async ({ request }) => {
    const before = await dbPrice();
    const body = await (await sync(request, 0)).json();
    expect(body.held[0]).toMatchObject({ reason: "zero-price" });
    const id = body.held[0].id;
    const approve = await request.post(`/api/sync/held-prices/${id}`, { headers: auth(HARNESS), data: { decision: "approve", approver: "discord:e2e" } });
    expect(approve.status()).toBe(409);
    expect((await approve.json()).error).toMatch(/₹0/);
    expect((await request.post(`/api/sync/held-prices/${id}`, { headers: auth(HARNESS), data: { decision: "reject", approver: "discord:e2e" } })).ok()).toBe(true);
    expect(await dbPrice()).toBe(before);
  });
});
