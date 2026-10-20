import { describe, expect, it } from "vitest";
import { auditEntityHref, cleanChanges, diffChanges, formatAuditValue } from "@/lib/admin/audit-diff";

describe("audit diffs", () => {
  it("records only the fields that changed, with before and after", () => {
    const before = { price: 2_499_900, mrp: 2_999_900, color: "Black", isActive: true };
    const after = { price: 2_399_900, mrp: 2_999_900, color: "Black", isActive: false };
    expect(diffChanges(before, after)).toEqual({ price: { before: 2_499_900, after: 2_399_900 }, isActive: { before: true, after: false } });
  });

  it("returns null when nothing changed, treating empty strings as null and dates by value", () => {
    const d = new Date("2026-10-01T10:00:00Z");
    expect(diffChanges({ a: "", b: d }, { a: null, b: new Date(d) })).toBeNull();
  });

  it("limits the comparison to the listed fields", () => {
    expect(diffChanges({ a: 1, b: 1 }, { a: 2, b: 2 }, ["a"])).toEqual({ a: { before: 1, after: 2 } });
  });

  it("never stores passwords, secrets or tokens", () => {
    const changes = diffChanges({ passwordHash: "x", apiSecret: "y", resetToken: "z", name: "A" }, { passwordHash: "x2", apiSecret: "y2", resetToken: "z2", name: "B" });
    expect(changes).toEqual({ name: { before: "A", after: "B" } });
    expect(cleanChanges({ password: { before: "a", after: "b" }, totpSecret: { before: 1, after: 2 } })).toBeNull();
  });

  it("detects a change past the stored length and trims long values", () => {
    const long = "x".repeat(500);
    const c = diffChanges({ description: long }, { description: `${long}y` });
    expect(c).not.toBeNull();
    expect(String(c!.description.after).length).toBeLessThanOrEqual(300);
  });

  it("formats paise as rupees and links entities", () => {
    expect(formatAuditValue("SKU-1.price", 2_399_900)).toBe("₹23,999");
    expect(formatAuditValue("stock", 5)).toBe("5");
    expect(formatAuditValue("isActive", false)).toBe("no");
    expect(formatAuditValue("note", null)).toBe("—");
    expect(auditEntityHref("order", "o1")).toBe("/admin/orders/o1");
    expect(auditEntityHref("product", "p1")).toBe("/admin/products/p1");
    expect(auditEntityHref("settings", "store")).toBe("/admin/settings");
    expect(auditEntityHref("unknown", "x")).toBeNull();
  });
});
