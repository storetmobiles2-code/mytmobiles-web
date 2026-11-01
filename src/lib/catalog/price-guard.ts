/** Price moves bigger than this share are held for the owner to check (an extra zero, a typo in the POS). */
export const MAX_AUTO_PRICE_CHANGE = 0.15;

export type PriceHoldReason = "zero-price" | "above-mrp" | "below-margin" | "large-change";

export const PRICE_HOLD_LABEL: Record<PriceHoldReason, string> = {
  "zero-price": "₹0 in the POS",
  "above-mrp": "Above MRP",
  "below-margin": "Below the margin floor",
  "large-change": `Change over ${MAX_AUTO_PRICE_CHANGE * 100}%`,
};

/**
 * Why an automatic price change (POS sync) must wait for a person, or null when
 * it can be applied. Selling above MRP is never allowed, and the sync never
 * raises MRP: that comes from the box or the brand, through a product file.
 * `belowMargin` comes from the shop-side sync, which checks the cost price
 * locally so cost never reaches the store.
 */
export function priceHoldReason(before: number, after: number, mrp: number, opts: { belowMargin?: boolean } = {}): PriceHoldReason | null {
  if (after === before) return null;
  // A POS item without a selling price (₹0) is never sold at 0.
  if (after <= 0) return "zero-price";
  if (after > mrp) return "above-mrp";
  if (opts.belowMargin) return "below-margin";
  if (before > 0 && Math.abs(after - before) / before > MAX_AUTO_PRICE_CHANGE) return "large-change";
  return null;
}

/**
 * Why a held price can't be approved now, or null when it can. Only the size
 * cap and the margin floor are judgement calls; a ₹0 or above-MRP price is
 * fixed in the POS or with an MRP change, never approved. The variant must
 * still be at the price the hold was made from, or the hold is out of date.
 */
export function approvalBlock(
  hold: { reason: PriceHoldReason; priceBefore: number; priceAfter: number },
  current: { price: number; mrp: number },
): string | null {
  if (hold.reason === "zero-price") return "A ₹0 price can't be approved. Set the selling price in the POS.";
  if (hold.reason === "above-mrp" || hold.priceAfter > current.mrp) return "The price is above MRP. Fix it in the POS, or correct the MRP through a product file.";
  if (current.price !== hold.priceBefore) return "The price has changed since this was held, so the hold is out of date.";
  return null;
}

/**
 * Which prices a rollback restores: the SKUs whose price is still what the
 * sync set. A SKU changed again since (by a later sync or a person) is left alone.
 */
export function rollbackPlan(
  changes: { sku: string; before: number; after: number }[],
  current: Map<string, number>,
): { restore: { sku: string; price: number }[]; skipped: string[] } {
  const restore: { sku: string; price: number }[] = [];
  const skipped: string[] = [];
  for (const c of changes) {
    if (c.before === c.after) continue;
    if (current.get(c.sku) === c.after && c.before > 0) restore.push({ sku: c.sku, price: c.before });
    else skipped.push(c.sku);
  }
  return { restore, skipped };
}
