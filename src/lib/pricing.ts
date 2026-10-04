/**
 * Pure pricing engine shared by the cart, checkout and order placement.
 * The server always recomputes totals with this module from database prices —
 * nothing the client sends is trusted.
 */
import { componentsFor, splitInclusive } from "./gst";

export interface PricingLine {
  variantId: string;
  productId: string;
  categoryId: string;
  brandId: string;
  unitPrice: number;
  mrp: number;
  quantity: number;
  gstRateBps: number;
}

export interface CouponRule {
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number;
  firstOrderOnly: boolean;
  applicableCategoryIds: string[];
  applicableBrandIds: string[];
  isActive: boolean;
}

export interface CouponContext {
  now: Date;
  /** Undefined when the shopper is anonymous: user-scoped checks are deferred to checkout. */
  userRedemptions?: number;
  userPaidOrders?: number;
}

export type CouponResult =
  | { ok: true; discount: number; eligibleSubtotal: number }
  | { ok: false; reason: string };

export function lineIsEligible(line: PricingLine, rule: CouponRule): boolean {
  const catOk = rule.applicableCategoryIds.length === 0 || rule.applicableCategoryIds.includes(line.categoryId);
  const brandOk = rule.applicableBrandIds.length === 0 || rule.applicableBrandIds.includes(line.brandId);
  return catOk && brandOk;
}

export function evaluateCoupon(rule: CouponRule, lines: PricingLine[], ctx: CouponContext): CouponResult {
  if (!rule.isActive) return { ok: false, reason: "This coupon is no longer active." };
  if (rule.startsAt && ctx.now < rule.startsAt) return { ok: false, reason: "This coupon is not active yet." };
  if (rule.endsAt && ctx.now > rule.endsAt) return { ok: false, reason: "This coupon has expired." };
  if (rule.usageLimit !== null && rule.usedCount >= rule.usageLimit)
    return { ok: false, reason: "This coupon has reached its usage limit." };
  if (ctx.userRedemptions !== undefined && ctx.userRedemptions >= rule.perUserLimit)
    return { ok: false, reason: "You have already used this coupon." };
  if (rule.firstOrderOnly && ctx.userPaidOrders !== undefined && ctx.userPaidOrders > 0)
    return { ok: false, reason: "This coupon is valid on your first order only." };

  const eligibleSubtotal = lines
    .filter((l) => lineIsEligible(l, rule))
    .reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  if (eligibleSubtotal === 0) return { ok: false, reason: "No items in your cart are eligible for this coupon." };
  if (eligibleSubtotal < rule.minOrderValue)
    return {
      ok: false,
      reason: `Add items worth ${formatShort(rule.minOrderValue - eligibleSubtotal)} more to use this coupon.`,
    };

  let discount =
    rule.type === "PERCENT" ? Math.floor((eligibleSubtotal * rule.value) / 100) : Math.min(rule.value, eligibleSubtotal);
  if (rule.type === "PERCENT" && rule.maxDiscount !== null) discount = Math.min(discount, rule.maxDiscount);
  discount = Math.max(0, Math.min(discount, eligibleSubtotal));

  return { ok: true, discount, eligibleSubtotal };
}

function formatShort(paise: number) {
  return `₹${Math.ceil(paise / 100).toLocaleString("en-IN")}`;
}

export interface FeeSettings {
  freeShippingThreshold: number;
  shippingFee: number;
  codFee: number;
}

export interface Totals {
  itemCount: number;
  mrpTotal: number;
  subtotal: number;
  /** MRP − selling price */
  productSavings: number;
  couponDiscount: number;
  shippingFee: number;
  codFee: number;
  total: number;
  /** productSavings + couponDiscount (+ waived shipping is not counted) */
  totalSavings: number;
  /** Amount still needed for free shipping, 0 if already free */
  freeShippingGap: number;
}

export function computeTotals(
  lines: PricingLine[],
  fees: FeeSettings,
  options: { couponDiscount?: number; paymentMethod?: "COD" | "RAZORPAY" } = {},
): Totals {
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const mrpTotal = lines.reduce((s, l) => s + Math.max(l.mrp, l.unitPrice) * l.quantity, 0);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const couponDiscount = Math.min(options.couponDiscount ?? 0, subtotal);
  const afterCoupon = subtotal - couponDiscount;

  const qualifiesFree = afterCoupon >= fees.freeShippingThreshold;
  const shippingFee = lines.length === 0 || qualifiesFree ? 0 : fees.shippingFee;
  const codFee = options.paymentMethod === "COD" && lines.length > 0 ? fees.codFee : 0;

  return {
    itemCount,
    mrpTotal,
    subtotal,
    productSavings: mrpTotal - subtotal,
    couponDiscount,
    shippingFee,
    codFee,
    total: afterCoupon + shippingFee + codFee,
    totalSavings: mrpTotal - subtotal + couponDiscount,
    freeShippingGap: lines.length === 0 || qualifiesFree ? 0 : fees.freeShippingThreshold - afterCoupon,
  };
}

/**
 * Distributes an order-level discount over lines proportionally to their value
 * (largest-remainder method) so that the shares sum exactly to the discount.
 * Only eligible lines receive a share.
 */
export function allocateDiscount(lineValues: number[], eligible: boolean[], discount: number): number[] {
  const base = lineValues.map((v, i) => (eligible[i] ? v : 0));
  const total = base.reduce((s, v) => s + v, 0);
  if (discount <= 0 || total === 0) return lineValues.map(() => 0);
  const raw = base.map((v) => (v * discount) / total);
  const shares = raw.map(Math.floor);
  let remainder = discount - shares.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .filter(({ i }) => base[i] > 0)
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0 && order.length > 0; k = (k + 1) % order.length, remainder--) {
    shares[order[k].i] += 1;
  }
  return shares;
}

export interface InvoiceLineInput {
  amountInclusive: number;
  gstRateBps: number;
}

export interface InvoiceTax {
  lines: { taxableValue: number; taxAmount: number }[];
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

/** Computes the GST breakup for a set of GST-inclusive invoice lines. */
export function computeInvoiceTax(lines: InvoiceLineInput[], isInterState: boolean): InvoiceTax {
  const out = lines.map((l) => splitInclusive(l.amountInclusive, l.gstRateBps));
  const taxableValue = out.reduce((s, l) => s + l.taxableValue, 0);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  for (const l of out) {
    const c = componentsFor(l.taxAmount, isInterState);
    cgst += c.cgst;
    sgst += c.sgst;
    igst += c.igst;
  }
  return { lines: out, taxableValue, cgst, sgst, igst };
}
