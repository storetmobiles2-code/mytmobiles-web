import "server-only";
import { db } from "@/lib/db";
import { planStockImport, type PlannedUpdate } from "./stock-import";
import { normaliseSheetName } from "./stock-parse";
import { refreshProductAggregates } from "./queries";
import { priceHoldReason, type PriceHoldReason } from "./price-guard";
import type { StockRow } from "./csv";

/** decidedBy on holds the sync itself retires */
const POS_SYNC_DECIDER = "pos-sync (superseded)";

/** One POS item as last seen by the myBillBook sync. */
export interface PosItem {
  /** myBillBook item id */
  id: string;
  name: string;
  /** Selling price in paise, GST-inclusive */
  price: number;
  quantity: number;
  category: string;
  /** Removed from the POS since the last sync */
  deleted: boolean;
  /** Set by the shop-side sync when the price is below its margin floor (cost never leaves the shop) */
  holdPrice?: "below-margin";
}

export interface HeldPrice {
  /** PriceHold id, for approving or rejecting it */
  id: string;
  sku: string;
  productName: string;
  priceBefore: number;
  priceAfter: number;
  mrp: number;
  reason: PriceHoldReason;
}

export interface PosSyncResult {
  updated: number;
  unchanged: number;
  /** Changed POS items that no variant lists in its stock-sheet names */
  unmatched: number;
  held: HeldPrice[];
  changes: { sku: string; slug: string; stockBefore: number; stockAfter: number; priceBefore: number; priceAfter: number }[];
}

/**
 * Applies changed POS items to the catalogue. A variant can combine several POS
 * items (e.g. "… BLACK" and "… BLACK WITHOUT TA"), so the latest copy of every
 * item is kept in PosStockItem and each affected variant is re-planned from all
 * of its items, exactly as a full stock-sheet import would. Prices that fail
 * priceHoldReason keep their current value and are stored as a PriceHold for
 * the owner; stock always applies. A newer POS price for the same variant
 * supersedes its older pending hold.
 */
export async function applyPosDelta(items: PosItem[]): Promise<PosSyncResult> {
  const previous = await db.posStockItem.findMany({ where: { id: { in: items.map((i) => i.id) } }, select: { nameKey: true } });
  const touchedKeys = new Set([...previous.map((p) => p.nameKey), ...items.map((i) => normaliseSheetName(i.name))]);
  const belowMarginKeys = new Set(items.filter((i) => i.holdPrice === "below-margin" && !i.deleted).map((i) => normaliseSheetName(i.name)));

  await db.$transaction([
    db.posStockItem.deleteMany({ where: { id: { in: items.filter((i) => i.deleted).map((i) => i.id) } } }),
    ...items
      .filter((i) => !i.deleted)
      .map((i) => {
        const data = { name: i.name, nameKey: normaliseSheetName(i.name), price: i.price, quantity: i.quantity, category: i.category };
        return db.posStockItem.upsert({ where: { id: i.id }, create: { id: i.id, ...data }, update: data });
      }),
  ]);

  const variants = await db.productVariant.findMany({ select: { id: true, sku: true, stock: true, externalNames: true, productId: true, product: { select: { slug: true } } } });
  const affected = variants
    .map((v) => ({ ...v, keys: v.externalNames.map(normaliseSheetName) }))
    .filter((v) => v.keys.some((k) => touchedKeys.has(k)));
  const keys = new Set(affected.flatMap((v) => v.keys));
  const unmatched = [...touchedKeys].filter((k) => !keys.has(k)).length;

  const stored = await db.posStockItem.findMany({ where: { nameKey: { in: [...keys] } } });
  const rows: StockRow[] = stored.map((r, i) => ({ name: r.name, price: r.price, quantity: r.quantity, category: r.category, line: i + 1 }));
  const updates: PlannedUpdate[] = rows.length ? (await planStockImport(rows)).updates : [];

  // Variants whose POS items were all removed: the shop no longer has them.
  const presentKeys = new Set(stored.map((r) => r.nameKey));
  const emptied = affected.filter((v) => v.stock > 0 && !v.keys.some((k) => presentKeys.has(k)));

  const byId = new Map(affected.map((v) => [v.id, v]));
  const mrps = new Map(
    (await db.productVariant.findMany({ where: { id: { in: updates.map((u) => u.variantId) } }, select: { id: true, mrp: true } })).map((v) => [v.id, v.mrp]),
  );
  const pending = new Map(
    (await db.priceHold.findMany({ where: { variantId: { in: updates.map((u) => u.variantId) }, status: "PENDING" }, select: { id: true, variantId: true, priceBefore: true, priceAfter: true } })).map((h) => [h.variantId, h]),
  );
  const held: HeldPrice[] = [];
  const changes: PosSyncResult["changes"] = [];
  const touchedProducts: string[] = [];
  await db.$transaction(
    async (tx) => {
      for (const u of updates) {
        const mrp = mrps.get(u.variantId) ?? 0;
        const v = byId.get(u.variantId);
        const belowMargin = !!v?.keys.some((k) => belowMarginKeys.has(k));
        const reason = priceHoldReason(u.priceBefore, u.priceAfter, mrp, { belowMargin });
        const open = pending.get(u.variantId);
        if (reason) {
          // The same price held again (a re-sent item) keeps its existing hold.
          let id = open && open.priceBefore === u.priceBefore && open.priceAfter === u.priceAfter ? open.id : null;
          if (!id) {
            if (open) await tx.priceHold.update({ where: { id: open.id }, data: { status: "SUPERSEDED", decidedBy: POS_SYNC_DECIDER, decidedAt: new Date() } });
            id = (await tx.priceHold.create({ data: { variantId: u.variantId, sku: u.sku, priceBefore: u.priceBefore, priceAfter: u.priceAfter, mrp, reason } })).id;
          }
          held.push({ id, sku: u.sku, productName: u.productName, priceBefore: u.priceBefore, priceAfter: u.priceAfter, mrp, reason });
        } else if (open) {
          // The POS moved on (a new price was applied, or it went back to the current one).
          await tx.priceHold.update({ where: { id: open.id }, data: { status: "SUPERSEDED", decidedBy: POS_SYNC_DECIDER, decidedAt: new Date() } });
        }
        const price = reason ? u.priceBefore : u.priceAfter;
        if (u.stockAfter === u.stockBefore && price === u.priceBefore) continue;
        await tx.productVariant.update({ where: { id: u.variantId }, data: { stock: u.stockAfter, price } });
        const delta = u.stockAfter - u.stockBefore;
        if (delta !== 0) await tx.inventoryLog.create({ data: { variantId: u.variantId, delta, reason: "POS sync (myBillBook)" } });
        changes.push({ sku: u.sku, slug: v?.product.slug ?? "", stockBefore: u.stockBefore, stockAfter: u.stockAfter, priceBefore: u.priceBefore, priceAfter: price });
        touchedProducts.push(u.productId);
      }
      for (const v of emptied) {
        await tx.productVariant.update({ where: { id: v.id }, data: { stock: 0 } });
        await tx.inventoryLog.create({ data: { variantId: v.id, delta: -v.stock, reason: "POS sync (myBillBook): item removed from POS" } });
        changes.push({ sku: v.sku, slug: v.product.slug, stockBefore: v.stock, stockAfter: 0, priceBefore: 0, priceAfter: 0 });
        touchedProducts.push(v.productId);
      }
      await refreshProductAggregates(touchedProducts, tx);
    },
    { timeout: 60_000 },
  );

  return { updated: changes.length, unchanged: affected.length - changes.length, unmatched, held, changes };
}
