import { describe, expect, it } from "vitest";
import { priceHoldReason } from "@/lib/catalog/price-guard";

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
  it("holds changes over 20%", () => {
    expect(priceHoldReason(1899900, 189990, 2499900)).toBe("large-change");
    expect(priceHoldReason(1000000, 1210000, 2000000)).toBe("large-change");
    expect(priceHoldReason(1000000, 1200000, 2000000)).toBeNull();
  });
});
