import { describe, expect, it } from "vitest";
import { componentsFor, isInterStateSupply, isValidGstin, splitInclusive } from "@/lib/gst";

describe("splitInclusive", () => {
  it("backs out 18% GST from an inclusive price", () => {
    // ₹1,18,000 inclusive @18% → ₹1,00,000 taxable + ₹18,000 tax
    expect(splitInclusive(11_800_000, 1800)).toEqual({ taxableValue: 10_000_000, taxAmount: 1_800_000 });
  });
  it("always sums back to the inclusive amount", () => {
    for (const amt of [1, 99, 7_999_00, 13_499_900, 3]) {
      const { taxableValue, taxAmount } = splitInclusive(amt, 1800);
      expect(taxableValue + taxAmount).toBe(amt);
    }
  });
  it("handles 0% rate", () => {
    expect(splitInclusive(5000, 0)).toEqual({ taxableValue: 5000, taxAmount: 0 });
  });
});

describe("componentsFor", () => {
  it("splits odd paise so CGST + SGST equals tax", () => {
    const c = componentsFor(1001, false);
    expect(c.cgst + c.sgst).toBe(1001);
    expect(c.igst).toBe(0);
  });
  it("uses IGST for inter-state", () => {
    expect(componentsFor(1800, true)).toEqual({ cgst: 0, sgst: 0, igst: 1800 });
  });
});

describe("isInterStateSupply", () => {
  it("compares state names case-insensitively", () => {
    expect(isInterStateSupply("Telangana", " telangana ")).toBe(false);
    expect(isInterStateSupply("Telangana", "Karnataka")).toBe(true);
  });
  it("treats unknown origin as inter-state", () => {
    expect(isInterStateSupply("", "Karnataka")).toBe(true);
  });
});

describe("isValidGstin", () => {
  it("accepts a GSTIN with a valid check digit", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
  });
  it("rejects a bad check digit or format", () => {
    expect(isValidGstin("27AAPFU0939F1ZX")).toBe(false);
    expect(isValidGstin("ABC")).toBe(false);
  });
});
