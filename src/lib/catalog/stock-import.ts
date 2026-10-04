import "server-only";
import { db } from "@/lib/db";
import { buildCatalog, KIND_META, type CatalogProduct } from "./build-catalog";
import { normaliseSheetName } from "./stock-parse";
import { refreshProductAggregates } from "./queries";
import { slugify } from "@/lib/slug";
import type { StockRow } from "./csv";

export interface PlannedUpdate {
  variantId: string;
  /** Units held by online orders not yet shipped (still on the shelf, already sold) */
  reserved: number;
  productId: string;
  productName: string;
  sku: string;
  sheetNames: string[];
  stockBefore: number;
  stockAfter: number;
  priceBefore: number;
  priceAfter: number;
  productActive: boolean;
}

export interface StockImportPlan {
  updates: PlannedUpdate[];
  unchanged: number;
  unmatched: StockRow[];
  /** Products that would be created from unmatched rows */
  newProducts: { name: string; variants: number; stock: number; existingProduct: boolean }[];
  missingFromSheet: number;
}

const key = (s: string) => normaliseSheetName(s);

/** Matches sheet rows to variants by their recorded stock-sheet names. No writes. */
export async function planStockImport(rows: StockRow[]): Promise<StockImportPlan> {
  const variants = await db.productVariant.findMany({
    select: { id: true, sku: true, stock: true, price: true, externalNames: true, productId: true, product: { select: { name: true, isActive: true } } },
  });
  const byName = new Map<string, (typeof variants)[number]>();
  for (const v of variants) for (const n of v.externalNames) byName.set(key(n), v);

  const grouped = new Map<string, { v: (typeof variants)[number]; rows: StockRow[] }>();
  const unmatched: StockRow[] = [];
  for (const r of rows) {
    const v = byName.get(key(r.name));
    if (!v) unmatched.push(r);
    else {
      const g = grouped.get(v.id) ?? { v, rows: [] };
      g.rows.push(r);
      grouped.set(v.id, g);
    }
  }

  // The sheet counts physical units. Units sold online but not yet shipped are still on the
  // shelf, so they are subtracted to get the quantity that can still be sold.
  const reservedRows = await db.orderItem.groupBy({
    by: ["variantId"],
    where: { variantId: { in: [...grouped.keys()] }, order: { status: { in: ["PENDING_PAYMENT", "CONFIRMED", "PACKED"] } } },
    _sum: { quantity: true },
  });
  const reserved = new Map(reservedRows.map((r) => [r.variantId!, r._sum.quantity ?? 0]));

  const updates: PlannedUpdate[] = [];
  let unchanged = 0;
  for (const { v, rows: rs } of grouped.values()) {
    const held = reserved.get(v.id) ?? 0;
    const stockAfter = Math.max(0, rs.reduce((s, r) => s + r.quantity, 0) - held);
    const priced = rs.filter((r) => r.quantity > 0);
    const priceAfter = Math.max(...(priced.length ? priced : rs).map((r) => r.price));
    if (stockAfter === v.stock && priceAfter === v.price) {
      unchanged++;
      continue;
    }
    updates.push({
      variantId: v.id,
      reserved: held,
      productId: v.productId,
      productName: v.product.name,
      sku: v.sku,
      sheetNames: rs.map((r) => r.name),
      stockBefore: v.stock,
      stockAfter,
      priceBefore: v.price,
      priceAfter,
      productActive: v.product.isActive,
    });
  }

  const { products } = buildCatalog({ rows: unmatched, reference: {}, images: {}, overrides: {} });
  const existingSlugs = new Set((await db.product.findMany({ where: { slug: { in: products.map((p) => p.slug) } }, select: { slug: true } })).map((p) => p.slug));
  return {
    updates,
    unchanged,
    unmatched,
    newProducts: products.map((p) => ({ name: p.name, variants: p.variants.length, stock: p.variants.reduce((s, v) => s + v.stock, 0), existingProduct: existingSlugs.has(p.slug) })),
    missingFromSheet: variants.length - grouped.size,
  };
}

async function createFromCatalog(products: CatalogProduct[], actorId: string): Promise<number> {
  const categories = new Map((await db.category.findMany()).map((c) => [c.slug, c.id]));
  let created = 0;
  for (const p of products) {
    const brand = await db.brand.upsert({ where: { name: p.brand }, update: {}, create: { name: p.brand, slug: slugify(p.brand) } });
    const existing = await db.product.findUnique({ where: { slug: p.slug }, select: { id: true } });
    const productId =
      existing?.id ??
      (
        await db.product.create({
          data: {
            slug: p.slug, name: p.name, brandId: brand.id, categoryId: categories.get(KIND_META[p.kind].category)!, condition: p.condition,
            shortDescription: p.shortDescription, description: p.description, highlights: p.highlights, specs: p.specs, keywords: p.keywords,
            boxContents: [], warranty: p.warranty, hsnCode: p.hsnCode, gstRateBps: p.gstRateBps, returnWindowDays: p.returnWindowDays, is5G: p.is5G,
            // New items start hidden so staff can add images & details before they go live.
            isActive: false,
          },
        })
      ).id;
    for (const v of p.variants) {
      const sku = (await db.productVariant.findUnique({ where: { sku: v.sku } })) ? `${v.sku}-${Date.now().toString(36).toUpperCase()}`.slice(0, 64) : v.sku;
      const nv = await db.productVariant.create({
        data: { productId, sku, color: v.color, storage: v.storage, storageGb: v.storageGb, ram: v.ram, ramGb: v.ramGb, price: v.price, mrp: v.mrp, stock: v.stock, externalNames: v.externalNames, lowStockThreshold: 2 },
      });
      if (v.stock > 0) await db.inventoryLog.create({ data: { variantId: nv.id, delta: v.stock, reason: "Stock import (new item)", actorId } });
    }
    await refreshProductAggregates([productId]);
    created++;
  }
  return created;
}

export interface ApplyOptions {
  activateRestocked: boolean;
  createUnmatched: boolean;
}

/** Re-plans from the uploaded rows (never trusts a client-side preview) and applies it. */
export async function applyStockImport(rows: StockRow[], opts: ApplyOptions, actorId: string) {
  const plan = await planStockImport(rows);
  await db.$transaction(
    async (tx) => {
      for (const u of plan.updates) {
        const delta = u.stockAfter - u.stockBefore;
        // Price can only lower MRP-based discounts, never push MRP below price.
        const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: u.variantId }, select: { mrp: true } });
        await tx.productVariant.update({ where: { id: u.variantId }, data: { stock: u.stockAfter, price: u.priceAfter, mrp: Math.max(variant.mrp, u.priceAfter) } });
        if (delta !== 0) await tx.inventoryLog.create({ data: { variantId: u.variantId, delta, reason: "Stock sheet import", actorId } });
      }
      const touched = [...new Set(plan.updates.map((u) => u.productId))];
      await refreshProductAggregates(touched, tx);
      if (opts.activateRestocked) {
        await tx.product.updateMany({ where: { id: { in: touched }, isActive: false, inStock: true }, data: { isActive: true } });
      }
    },
    { timeout: 60_000 },
  );
  let created = 0;
  if (opts.createUnmatched && plan.unmatched.length) {
    created = await createFromCatalog(buildCatalog({ rows: plan.unmatched, reference: {}, images: {}, overrides: {} }).products, actorId);
  }
  return { updated: plan.updates.length, unchanged: plan.unchanged, created, unmatched: plan.unmatched.length };
}
