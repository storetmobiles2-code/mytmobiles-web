import { describe, expect, it } from "vitest";
import { addDeliveryDays, deliveryBand, estimateDelivery, type DeliverySettings } from "@/lib/delivery";

const s: DeliverySettings = {
  pincode: "500081",
  state: "Telangana",
  deliveryDaysLocal: 1,
  deliveryDaysState: 3,
  deliveryDaysNational: 5,
  deliveryDaysRemote: 8,
  remotePincodePrefixes: ["18", "19", "78", "79", "744"],
  blockedPincodes: ["110001"],
  codBlockedPincodes: ["560001"],
  codEnabled: true,
};

describe("deliveryBand", () => {
  it("classifies by pincode/state", () => {
    expect(deliveryBand("500032", "Telangana", s)).toBe("LOCAL");
    expect(deliveryBand("506001", "Telangana", s)).toBe("STATE");
    expect(deliveryBand("560001", "Karnataka", s)).toBe("NATIONAL");
    expect(deliveryBand("781001", "Assam", s)).toBe("REMOTE");
    expect(deliveryBand("744101", null, s)).toBe("REMOTE");
  });
});

describe("estimateDelivery", () => {
  // 10:00 IST on a Thursday
  const morning = new Date("2026-10-01T04:30:00Z");
  it("is not serviceable for blocked or malformed pincodes", () => {
    expect(estimateDelivery("110001", "Delhi", s, morning).serviceable).toBe(false);
    expect(estimateDelivery("012345", null, s, morning).serviceable).toBe(false);
  });
  it("disables COD where blocked or globally off", () => {
    expect(estimateDelivery("560001", "Karnataka", s, morning).codAvailable).toBe(false);
    expect(estimateDelivery("560002", "Karnataka", { ...s, codEnabled: false }, morning).codAvailable).toBe(false);
    expect(estimateDelivery("560002", "Karnataka", s, morning).codAvailable).toBe(true);
  });
  it("adds a day after the dispatch cut-off", () => {
    const evening = new Date("2026-10-01T12:30:00Z"); // 18:00 IST
    expect(estimateDelivery("560002", "Karnataka", s, evening).minDays).toBe(
      estimateDelivery("560002", "Karnataka", s, morning).minDays + 1,
    );
  });
});

describe("addDeliveryDays", () => {
  it("skips Sundays", () => {
    // Saturday 3 Oct 2026, 10:00 IST + 1 business day → Monday 5 Oct
    const sat = new Date("2026-10-03T04:30:00Z");
    const d = addDeliveryDays(sat, 1);
    expect(d.toISOString().slice(0, 10)).toBe("2026-10-05");
  });
});
