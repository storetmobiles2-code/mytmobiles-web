import { describe, expect, it } from "vitest";
import {
  allocateDiscount,
  computeInvoiceTax,
  computeTotals,
  evaluateCoupon,
  type CouponRule,
  type PricingLine,
} from "@/lib/pricing";

const line = (over: Partial<PricingLine> = {}): PricingLine => ({
  variantId: "v1",
  productId: "p1",
  categoryId: "phones",
  brandId: "apple",
  unitPrice: 79_900_00,
  mrp: 82_900_00,
  quantity: 1,
  gstRateBps: 1800,
  ...over,
});

const rule = (over: Partial<CouponRule> = {}): CouponRule => ({
  code: "SAVE10",
  type: "PERCENT",
  value: 10,
  maxDiscount: 2_000_00,
  minOrderValue: 0,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  usedCount: 0,
  perUserLimit: 1,
  firstOrderOnly: false,
  applicableCategoryIds: [],
  applicableBrandIds: [],
  isActive: true,
  ...over,
});

const fees = { freeShippingThreshold: 499_00, shippingFee: 49_00, codFee: 0 };
const now = new Date("2026-10-01T10:00:00Z");

describe("computeTotals", () => {
  it("computes MRP savings and free shipping", () => {
    const t = computeTotals([line({ quantity: 2 })], fees);
    expect(t.mrpTotal).toBe(165_800_00);
    expect(t.subtotal).toBe(159_800_00);
    expect(t.productSavings).toBe(6_000_00);
    expect(t.shippingFee).toBe(0);
    expect(t.total).toBe(159_800_00);
  });
  it("charges shipping below the threshold, and reports the gap", () => {
    const t = computeTotals([line({ unitPrice: 299_00, mrp: 499_00 })], fees);
    expect(t.shippingFee).toBe(49_00);
    expect(t.freeShippingGap).toBe(200_00);
    expect(t.total).toBe(348_00);
  });
  it("evaluates the free-shipping threshold after the coupon", () => {
    const t = computeTotals([line({ unitPrice: 520_00, mrp: 520_00 })], fees, { couponDiscount: 50_00 });
    expect(t.shippingFee).toBe(49_00);
  });
  it("adds a COD fee only for COD", () => {
    const f = { ...fees, codFee: 30_00 };
    expect(computeTotals([line()], f, { paymentMethod: "COD" }).codFee).toBe(30_00);
    expect(computeTotals([line()], f, { paymentMethod: "RAZORPAY" }).codFee).toBe(0);
  });
  it("returns zeros for an empty cart", () => {
    const t = computeTotals([], fees);
    expect(t.total).toBe(0);
    expect(t.shippingFee).toBe(0);
  });
});

describe("evaluateCoupon", () => {
  it("applies a capped percentage", () => {
    const r = evaluateCoupon(rule(), [line()], { now });
    expect(r).toEqual({ ok: true, discount: 2_000_00, eligibleSubtotal: 79_900_00 });
  });
  it("applies a flat discount, never above the eligible amount", () => {
    const r = evaluateCoupon(rule({ type: "FLAT", value: 500_00 }), [line({ unitPrice: 300_00 })], { now });
    expect(r).toMatchObject({ ok: true, discount: 300_00 });
  });
  it("enforces minimum order value on eligible items only", () => {
    const r = evaluateCoupon(
      rule({ minOrderValue: 1_000_00, applicableCategoryIds: ["audio"] }),
      [line(), line({ variantId: "v2", categoryId: "audio", unitPrice: 900_00 })],
      { now },
    );
    expect(r.ok).toBe(false);
  });
  it("restricts by brand", () => {
    const r = evaluateCoupon(rule({ applicableBrandIds: ["samsung"] }), [line()], { now });
    expect(r).toEqual({ ok: false, reason: "No items in your cart are eligible for this coupon." });
  });
  it("respects validity window and limits", () => {
    expect(evaluateCoupon(rule({ endsAt: new Date("2026-09-01") }), [line()], { now }).ok).toBe(false);
    expect(evaluateCoupon(rule({ startsAt: new Date("2026-11-01") }), [line()], { now }).ok).toBe(false);
    expect(evaluateCoupon(rule({ usageLimit: 5, usedCount: 5 }), [line()], { now }).ok).toBe(false);
    expect(evaluateCoupon(rule(), [line()], { now, userRedemptions: 1 }).ok).toBe(false);
    expect(evaluateCoupon(rule({ firstOrderOnly: true }), [line()], { now, userPaidOrders: 2 }).ok).toBe(false);
    expect(evaluateCoupon(rule({ isActive: false }), [line()], { now }).ok).toBe(false);
  });
});

describe("allocateDiscount", () => {
  it("sums exactly to the discount", () => {
    const shares = allocateDiscount([333, 333, 334], [true, true, true], 100);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("skips ineligible lines", () => {
    expect(allocateDiscount([1000, 1000], [true, false], 101)).toEqual([101, 0]);
  });
  it("returns zeros when nothing to allocate", () => {
    expect(allocateDiscount([1000], [true], 0)).toEqual([0]);
  });
});

describe("computeInvoiceTax", () => {
  it("splits intra-state tax into CGST and SGST", () => {
    const t = computeInvoiceTax([{ amountInclusive: 11_800_00, gstRateBps: 1800 }], false);
    expect(t).toMatchObject({ taxableValue: 10_000_00, cgst: 900_00, sgst: 900_00, igst: 0 });
  });
  it("uses IGST inter-state and balances with the inclusive total", () => {
    const lines = [
      { amountInclusive: 79_900_00, gstRateBps: 1800 },
      { amountInclusive: 1_899_00, gstRateBps: 1800 },
    ];
    const t = computeInvoiceTax(lines, true);
    expect(t.cgst).toBe(0);
    expect(t.taxableValue + t.igst).toBe(81_799_00);
  });
});
