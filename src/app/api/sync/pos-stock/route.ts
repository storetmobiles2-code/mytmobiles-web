import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { applyPosDelta } from "@/lib/catalog/pos-sync";
import { audit } from "@/lib/admin/audit";
import type { AuditChanges } from "@/lib/admin/audit-diff";

export const dynamic = "force-dynamic";

const POS_SYNC_ACTOR = { email: "pos-sync (myBillBook)" } as const;

const item = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(300),
  /** Rupees, GST-inclusive */
  price: z.number().finite().nonnegative().max(10_000_000),
  quantity: z.number().finite(),
  category: z.string().max(190).default(""),
  deleted: z.boolean().default(false),
});
const body = z.object({ items: z.array(item).min(1).max(5000) });

/**
 * Receives changed items from the myBillBook sync (mbb_sync.py, run by cron) and
 * applies their stock and prices. Values are absolute and items are upserted by
 * id, so a retried request is safe.
 *
 *   curl -X POST -H "Authorization: Bearer $POS_SYNC_SECRET" -H "Content-Type: application/json" \
 *     -d '{"items":[{"id":"…","name":"SAMSUNG GALAXY A17 5G 6/128 BLACK","price":18999,"quantity":3,"category":"SAMSUNG MOBILES"}]}' \
 *     https://<site>/api/sync/pos-stock
 */
export async function POST(req: NextRequest) {
  const secret = env().POS_SYNC_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });

  // Same conversions as parseStockCsv: paise, whole units, no negative stock.
  const r = await applyPosDelta(
    parsed.data.items.map((i) => ({
      id: i.id,
      name: i.name.replace(/\s+/g, " "),
      price: Math.round(i.price * 100),
      quantity: Math.max(0, Math.floor(i.quantity)),
      category: i.category.trim(),
      deleted: i.deleted,
    })),
  );

  if (r.updated || r.held.length) {
    // One entry per sync; before/after per SKU for stock and price (capped so the row stays small).
    const changes: AuditChanges = {};
    for (const c of r.changes.slice(0, 400)) {
      if (c.stockBefore !== c.stockAfter) changes[`${c.sku}.stock`] = { before: c.stockBefore, after: c.stockAfter };
      if (c.priceBefore !== c.priceAfter) changes[`${c.sku}.price`] = { before: c.priceBefore, after: c.priceAfter };
    }
    const heldSummary = r.held.length ? `, ${r.held.length} price changes held for review (${r.held.map((h) => `${h.sku}: ${h.reason}`).join(", ").slice(0, 200)})` : "";
    await audit({
      actor: POS_SYNC_ACTOR,
      action: "stock.synced",
      entityType: "stock_import",
      summary: `POS sync: ${parsed.data.items.length} items received, ${r.updated} variants updated, ${r.unmatched} items not on the site${heldSummary}`,
      changes,
    });
  }
  if (r.updated) {
    revalidateTag("catalog", { expire: 0 });
    revalidatePath("/", "layout");
  }

  return NextResponse.json({ updated: r.updated, unchanged: r.unchanged, unmatched: r.unmatched, held: r.held });
}
