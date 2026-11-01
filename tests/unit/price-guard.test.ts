import { describe, expect, it } from "vitest";
import { approvalBlock, priceHoldReason, rollbackPlan } from "@/lib/catalog/price-guard";

describe("priceHoldReason", () => {
  it("applies small changes within MRP", () => {
    expect(priceHoldReason(1899900, 1799900, 2499900)).toBeNull();
    expect(priceHoldReason(1899900, 1899900, 1000)).toBeNull();
  });
  it("holds a zero price, even when the current price is zero too", () => {
    expect(priceHoldReason(299900, 0, 349900)).toBe("zero-price");
    expect(priceHoldReason(0, 0, 349900)).toBeNull();
    expect(priceHoldReason(1, 0, 349900)).toBe("zero-price");
  });
  it("holds prices above MRP", () => {
    expect(priceHoldReason(1899900, 2599900, 1999900)).toBe("above-mrp");
  });
  it("holds changes over 15%", () => {
    expect(priceHoldReason(1899900, 189990, 2499900)).toBe("large-change");
    expect(priceHoldReason(1000000, 1160000, 2000000)).toBe("large-change");
    expect(priceHoldReason(1000000, 840000, 2000000)).toBe("large-change");
    expect(priceHoldReason(1000000, 1150000, 2000000)).toBeNull();
    expect(priceHoldReason(1000000, 850000, 2000000)).toBeNull();
  });
  it("holds prices the shop flags as below its margin floor", () => {
    expect(priceHoldReason(1000000, 990000, 2000000, { belowMargin: true })).toBe("below-margin");
    expect(priceHoldReason(1000000, 1000000, 2000000, { belowMargin: true })).toBeNull();
  });
  it("puts ₹0 and above-MRP ahead of the margin flag", () => {
    expect(priceHoldReason(1000000, 0, 2000000, { belowMargin: true })).toBe("zero-price");
    expect(priceHoldReason(1000000, 2100000, 2000000, { belowMargin: true })).toBe("above-mrp");
  });
});

describe("approvalBlock", () => {
  const current = { price: 1000000, mrp: 2000000 };
  it("allows a size-cap or margin hold while the price is unchanged", () => {
    expect(approvalBlock({ reason: "large-change", priceBefore: 1000000, priceAfter: 1300000 }, current)).toBeNull();
    expect(approvalBlock({ reason: "below-margin", priceBefore: 1000000, priceAfter: 950000 }, current)).toBeNull();
  });
  it("never allows ₹0 or above-MRP prices", () => {
    expect(approvalBlock({ reason: "zero-price", priceBefore: 1000000, priceAfter: 0 }, current)).toMatch(/₹0/);
    expect(approvalBlock({ reason: "above-mrp", priceBefore: 1000000, priceAfter: 2100000 }, current)).toMatch(/above MRP/);
  });
  it("re-checks MRP at approval time", () => {
    expect(approvalBlock({ reason: "large-change", priceBefore: 1000000, priceAfter: 1300000 }, { price: 1000000, mrp: 1200000 })).toMatch(/above MRP/);
  });
  it("refuses a hold made from a price that has since changed", () => {
    expect(approvalBlock({ reason: "large-change", priceBefore: 900000, priceAfter: 1300000 }, current)).toMatch(/out of date/);
  });
});

describe("rollbackPlan", () => {
  it("restores only SKUs still at the synced price", () => {
    const plan = rollbackPlan(
      [
        { sku: "A", before: 100, after: 110 },
        { sku: "B", before: 200, after: 220 },
        { sku: "C", before: 300, after: 300 },
      ],
      new Map([["A", 110], ["B", 230], ["C", 300]]),
    );
    expect(plan.restore).toEqual([{ sku: "A", price: 100 }]);
    expect(plan.skipped).toEqual(["B"]);
  });
  it("never restores a zero price", () => {
    expect(rollbackPlan([{ sku: "A", before: 0, after: 110 }], new Map([["A", 110]])).restore).toEqual([]);
  });
});
