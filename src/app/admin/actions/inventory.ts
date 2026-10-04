"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/auth/guards";
import { refreshProductAggregates } from "@/lib/catalog/queries";
import { parseStockCsv } from "@/lib/catalog/csv";
import { applyStockImport, planStockImport, type StockImportPlan } from "@/lib/catalog/stock-import";
import { revalidateStorefront } from "@/lib/admin/revalidate";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export async function adjustStock(_prev: { ok?: string; error?: string }, fd: FormData): Promise<{ ok?: string; error?: string }> {
  const admin = await assertAdmin();
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
    const v = await tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true, productId: true } });
    if (!v) return { error: "Variant not found." };
    const next = mode === "set" ? quantity : v.stock + quantity;
    if (next < 0) return { error: "Stock can't go below zero." };
    await tx.productVariant.update({ where: { id: variantId }, data: { stock: next } });
    await tx.inventoryLog.create({ data: { variantId, delta: next - v.stock, reason, actorId: admin.id } });
    await refreshProductAggregates([v.productId], tx);
    return { ok: `Stock is now ${next}.` };
  });
  revalidateStorefront();
  return result;
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
  await assertAdmin();
  const { text, error } = await readCsv(fd);
  if (!text) return { error };
  const { rows, errors } = parseStockCsv(text);
  if (!rows.length) return { error: errors[0]?.message ?? "No rows found.", parseErrors: errors };
  return { plan: await planStockImport(rows), csv: text, parseErrors: errors };
}

export async function applyStockImportAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const admin = await assertAdmin();
  const { text, error } = await readCsv(fd);
  if (!text) return { error };
  const { rows } = parseStockCsv(text);
  const r = await applyStockImport(rows, { activateRestocked: fd.get("activateRestocked") === "on", createUnmatched: fd.get("createUnmatched") === "on" }, admin.id);
  revalidateStorefront();
  return { ok: `Import complete: ${r.updated} variants updated, ${r.unchanged} unchanged, ${r.created} new products created (hidden until reviewed)${r.unmatched && !r.created ? `, ${r.unmatched} rows not matched` : ""}.` };
}
