"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/guards";
import { refreshProductAggregates } from "@/lib/catalog/queries";
import { parseStockCsv } from "@/lib/catalog/csv";
import { applyStockImport, planStockImport, type StockImportPlan } from "@/lib/catalog/stock-import";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import { audit } from "@/lib/admin/audit";
import type { AuditChanges } from "@/lib/admin/audit-diff";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export async function adjustStock(_prev: { ok?: string; error?: string }, fd: FormData): Promise<{ ok?: string; error?: string }> {
  const admin = await assertPermission("inventory.adjust");
  const parsed = z
    .object({
      variantId: z.string().cuid(),
      mode: z.enum(["set", "add"]),
      quantity: z.coerce.number().int().min(-10000).max(10000),
      reason: z.string().trim().min(3, "Enter a reason").max(190),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { variantId, mode, quantity, reason } = parsed.data;
  const result = await db.$transaction(async (tx) => {
    const v = await tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true, productId: true, sku: true } });
    if (!v) return { error: "Variant not found." };
    const next = mode === "set" ? quantity : v.stock + quantity;
    if (next < 0) return { error: "Stock can't go below zero." };
    await tx.productVariant.update({ where: { id: variantId }, data: { stock: next } });
    await tx.inventoryLog.create({ data: { variantId, delta: next - v.stock, reason, actorId: admin.id } });
    await refreshProductAggregates([v.productId], tx);
    return { ok: `Stock is now ${next}.`, log: { productId: v.productId, sku: v.sku, before: v.stock, after: next } };
  });
  if ("error" in result) return result;
  const { productId, sku, before, after } = result.log;
  await audit({ actor: admin, action: "stock.adjusted", entityType: "product", entityId: productId, summary: `${sku}: stock ${before} → ${after} (${reason})`, changes: { [`${sku}.stock`]: { before, after } } });
  revalidateStorefront();
  return { ok: result.ok };
}

async function readCsv(fd: FormData): Promise<{ text?: string; error?: string }> {
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV_BYTES) return { error: "CSV must be 2 MB or smaller." };
    return { text: await file.text() };
  }
  const text = fd.get("csv");
  if (typeof text === "string" && text.length > 0 && text.length <= MAX_CSV_BYTES) return { text };
  return { error: "Choose a CSV file exported from your stock sheet." };
}

export type ImportState = { error?: string; ok?: string; plan?: StockImportPlan; csv?: string; parseErrors?: { line: number; message: string }[] };

export async function previewStockImport(_prev: ImportState, fd: FormData): Promise<ImportState> {
  await assertPermission("inventory.import");
  const { text, error } = await readCsv(fd);
  if (!text) return { error };
  const { rows, errors } = parseStockCsv(text);
  if (!rows.length) return { error: errors[0]?.message ?? "No rows found.", parseErrors: errors };
  return { plan: await planStockImport(rows), csv: text, parseErrors: errors };
}

export async function applyStockImportAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const admin = await assertPermission("inventory.import");
  const { text, error } = await readCsv(fd);
  if (!text) return { error };
  const { rows } = parseStockCsv(text);
  const r = await applyStockImport(rows, { activateRestocked: fd.get("activateRestocked") === "on", createUnmatched: fd.get("createUnmatched") === "on" }, admin.id);
  // One entry per import; before/after per SKU for stock and price (capped so the row stays small).
  const changes: AuditChanges = {};
  for (const u of r.updates.slice(0, 400)) {
    if (u.stockBefore !== u.stockAfter) changes[`${u.sku}.stock`] = { before: u.stockBefore, after: u.stockAfter };
    if (u.priceBefore !== u.priceAfter) changes[`${u.sku}.price`] = { before: u.priceBefore, after: u.priceAfter };
  }
  const file = fd.get("file");
  await audit({
    actor: admin,
    action: "stock.imported",
    entityType: "stock_import",
    summary: `Stock sheet import${file instanceof File && file.name ? ` (${file.name.slice(0, 80)})` : ""}: ${r.updated} variants updated, ${r.unchanged} unchanged, ${r.created} products created, ${r.unmatched} rows not matched${r.updates.length > 400 ? " (first 400 changes listed)" : ""}`,
    changes,
  });
  revalidateStorefront();
  return { ok: `Import complete: ${r.updated} variants updated, ${r.unchanged} unchanged, ${r.created} new products created (hidden until reviewed)${r.unmatched && !r.created ? `, ${r.unmatched} rows not matched` : ""}.` };
}
