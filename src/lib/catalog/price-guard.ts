/** Price moves bigger than this share are held for staff to check (an extra zero, a typo in the POS). */
export const MAX_AUTO_PRICE_CHANGE = 0.2;

export type PriceHoldReason = "zero-price" | "above-mrp" | "large-change";

/**
 * Why an automatic price change (POS sync) must wait for a person, or null when
 * it can be applied. Selling above MRP is never allowed, and the sync never
 * raises MRP: that comes from the box or the brand, through a product file.
 */
export function priceHoldReason(before: number, after: number, mrp: number): PriceHoldReason | null {
  if (after === before) return null;
  // A POS item without a selling price (₹0) is never sold at 0.
  if (after <= 0) return "zero-price";
  if (after > mrp) return "above-mrp";
  if (before > 0 && Math.abs(after - before) / before > MAX_AUTO_PRICE_CHANGE) return "large-change";
  return null;
}
