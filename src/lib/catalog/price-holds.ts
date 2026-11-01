import "server-only";
import { db } from "@/lib/db";
import { audit, type AuditActor } from "@/lib/admin/audit";
import type { AuditChanges } from "@/lib/admin/audit-diff";
import { approvalBlock, PRICE_HOLD_LABEL, rollbackPlan, type PriceHoldReason } from "./price-guard";
import { refreshProductAggregates } from "./queries";

/** POS prices the sync held for the owner (oldest first). */
export async function pendingPriceHolds(take = 200) {
  const holds = await db.priceHold.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take,
    include: { variant: { select: { price: true, mrp: true, color: true, storage: true, ram: true, product: { select: { id: true, name: true, slug: true } } } } },
  });
  return holds.map((h) => {
    const reason = h.reason as PriceHoldReason;
    return { ...h, reason, label: PRICE_HOLD_LABEL[reason] ?? h.reason, approvable: approvalBlock({ reason, priceBefore: h.priceBefore, priceAfter: h.priceAfter }, h.variant) === null };
  });
}

export type DecisionResult = { ok: string; productId: string } | { error: string; status: 404 | 409 };

/**
 * Approves (applies the held POS price) or rejects a hold. The hold is claimed
 * with a conditional update, so two approvers can't both act on it. Approval
 * re-checks MRP and that the price hasn't moved since; a stale hold is retired.
 * The caller refreshes the storefront cache.
 */
export async function decidePriceHold(id: string, decision: "approve" | "reject", actor: NonNullable<AuditActor>, decidedBy: string): Promise<DecisionResult> {
  type Internal = { error: string; status: 404 | 409 } | { ok: string; productId: string; sku: string; reason: string; log?: { before: number; after: number } };
  const result = await db.$transaction(async (tx): Promise<Internal> => {
    const hold = await tx.priceHold.findUnique({ where: { id }, include: { variant: { select: { price: true, mrp: true, productId: true } } } });
    if (!hold) return { error: "No such held price.", status: 404 };
    if (hold.status !== "PENDING") return { error: `This price was already ${hold.status.toLowerCase()}.`, status: 409 };
    const decided = { decidedBy: decidedBy.slice(0, 190), decidedAt: new Date() };
    if (decision === "reject") {
      const claimed = await tx.priceHold.updateMany({ where: { id, status: "PENDING" }, data: { status: "REJECTED", ...decided } });
      if (!claimed.count) return { error: "Someone else decided this price first.", status: 409 };
      return { ok: `${hold.sku}: kept at the current price.`, productId: hold.variant.productId, sku: hold.sku, reason: hold.reason };
    }
    const block = approvalBlock({ reason: hold.reason as PriceHoldReason, priceBefore: hold.priceBefore, priceAfter: hold.priceAfter }, hold.variant);
    if (block) {
      if (hold.variant.price !== hold.priceBefore) await tx.priceHold.updateMany({ where: { id, status: "PENDING" }, data: { status: "SUPERSEDED", ...decided } });
      return { error: block, status: 409 };
    }
    const claimed = await tx.priceHold.updateMany({ where: { id, status: "PENDING" }, data: { status: "APPROVED", ...decided } });
    if (!claimed.count) return { error: "Someone else decided this price first.", status: 409 };
    await tx.productVariant.update({ where: { id: hold.variantId }, data: { price: hold.priceAfter } });
    await refreshProductAggregates([hold.variant.productId], tx);
    return { ok: `${hold.sku}: price updated.`, productId: hold.variant.productId, sku: hold.sku, reason: hold.reason, log: { before: hold.priceBefore, after: hold.priceAfter } };
  });
  if ("error" in result) return result;
  await audit({
    actor,
    action: decision === "approve" ? "price_hold.approved" : "price_hold.rejected",
    entityType: "product",
    entityId: result.productId,
    summary: `${result.sku}: held POS price ${decision === "approve" ? "approved" : "rejected"} (${result.reason}) by ${decidedBy}`,
    changes: result.log ? { [`${result.sku}.price`]: { before: result.log.before, after: result.log.after } } : null,
  });
  return { ok: result.ok, productId: result.productId };
}

export type RollbackResult = { restored: number; skipped: string[]; auditId: string | null } | { error: string; status: 400 | 404 };

/**
 * Undoes the price changes of one POS sync (the canary calls this when the
 * pages look wrong after a sync). Driven by that sync's audit entry; a SKU whose
 * price changed again since is left alone. Stock is never rolled back: it
 * reflects the shelf.
 */
export async function rollbackPosSync(auditId: string, actor: NonNullable<AuditActor>): Promise<RollbackResult> {
  const entry = await db.auditLog.findUnique({ where: { id: auditId }, select: { action: true, changes: true, createdAt: true } });
  if (!entry) return { error: "No such sync.", status: 404 };
  if (entry.action !== "stock.synced") return { error: "That audit entry isn't a POS sync.", status: 400 };
  const changes = Object.entries((entry.changes ?? {}) as AuditChanges)
    .filter(([key, v]) => key.endsWith(".price") && typeof v.before === "number" && typeof v.after === "number")
    .map(([key, v]) => ({ sku: key.slice(0, -".price".length), before: v.before as number, after: v.after as number }));
  const variants = await db.productVariant.findMany({ where: { sku: { in: changes.map((c) => c.sku) } }, select: { id: true, sku: true, price: true, productId: true } });
  const plan = rollbackPlan(changes, new Map(variants.map((v) => [v.sku, v.price])));
  const bySku = new Map(variants.map((v) => [v.sku, v]));
  if (plan.restore.length) {
    await db.$transaction(async (tx) => {
      for (const r of plan.restore) await tx.productVariant.update({ where: { id: bySku.get(r.sku)!.id }, data: { price: r.price } });
      await refreshProductAggregates([...new Set(plan.restore.map((r) => bySku.get(r.sku)!.productId))], tx);
    });
  }
  const logged: AuditChanges = {};
  for (const r of plan.restore) logged[`${r.sku}.price`] = { before: bySku.get(r.sku)!.price, after: r.price };
  const id = await audit({
    actor,
    action: "stock.sync_rolled_back",
    entityType: "stock_import",
    entityId: auditId,
    summary: `POS sync of ${entry.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC rolled back: ${plan.restore.length} prices restored${plan.skipped.length ? `, ${plan.skipped.length} left alone because they changed again (${plan.skipped.join(", ").slice(0, 200)})` : ""}`,
    changes: logged,
  });
  return { restored: plan.restore.length, skipped: plan.skipped, auditId: id };
}
