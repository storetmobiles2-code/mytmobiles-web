import { describe, expect, it } from "vitest";
import { canAccessAdmin, cancelPermissions, hasPermission, PERMISSIONS, permissionsFor, ROLE_PERMISSIONS, statusChangePermission, type Permission } from "@/lib/auth/permissions";
import { staffChangeError, type StaffChangeInput } from "@/lib/auth/staff-rules";

describe("role → permission map", () => {
  it("gives ADMIN every permission", () => {
    for (const p of PERMISSIONS) expect(hasPermission("ADMIN", p), p).toBe(true);
  });

  it("gives CUSTOMER nothing and keeps them out of the admin", () => {
    expect(permissionsFor("CUSTOMER")).toEqual([]);
    expect(canAccessAdmin("CUSTOMER")).toBe(false);
    expect(canAccessAdmin(null)).toBe(false);
  });

  it("lets STAFF into the admin for day-to-day fulfilment", () => {
    expect(canAccessAdmin("STAFF")).toBe(true);
    const allowed: Permission[] = ["dashboard.view", "orders.view", "orders.update", "orders.print", "orders.cancel", "products.view", "reviews.moderate", "grievances.manage"];
    for (const p of allowed) expect(hasPermission("STAFF", p), p).toBe(true);
  });

  it("keeps money, catalogue, settings, customers and staff away from STAFF", () => {
    const denied: Permission[] = [
      "orders.refund",
      "products.edit",
      "inventory.adjust",
      "inventory.import",
      "categories.manage",
      "coupons.manage",
      "banners.manage",
      "settings.manage",
      "customers.view",
      "customers.manage",
      "analytics.view",
      "reports.view",
      "staff.manage",
      "audit.view",
    ];
    for (const p of denied) expect(hasPermission("STAFF", p), p).toBe(false);
    // Every permission is either explicitly allowed or explicitly denied above.
    expect(ROLE_PERMISSIONS.STAFF.length + denied.length).toBe(PERMISSIONS.length);
  });

  it("treats receiving a return as a refund", () => {
    expect(statusChangePermission("RETURNED")).toBe("orders.refund");
    for (const to of ["PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]) expect(statusChangePermission(to)).toBe("orders.update");
  });

  it("needs the refund permission to cancel a paid online order only", () => {
    expect(cancelPermissions({ paymentMethod: "RAZORPAY", paymentStatus: "PAID" })).toEqual(["orders.cancel", "orders.refund"]);
    expect(cancelPermissions({ paymentMethod: "RAZORPAY", paymentStatus: "PENDING" })).toEqual(["orders.cancel"]);
    expect(cancelPermissions({ paymentMethod: "COD", paymentStatus: "PENDING" })).toEqual(["orders.cancel"]);
    expect(cancelPermissions({ paymentMethod: "RAZORPAY", paymentStatus: "PAID" }).every((p) => hasPermission("STAFF", p))).toBe(false);
  });
});

describe("staff changes and last-admin protection", () => {
  const admin = { id: "a1", role: "ADMIN" as const, isDisabled: false };
  const staff = { id: "s1", role: "STAFF" as const, isDisabled: false };
  const check = (over: Partial<StaffChangeInput>) => staffChangeError({ actorId: "a1", target: staff, change: { kind: "role", to: "ADMIN" }, activeAdmins: 1, ...over });

  it("lets an admin promote, demote and disable other people", () => {
    expect(check({})).toBeNull();
    expect(check({ change: { kind: "role", to: "CUSTOMER" } })).toBeNull();
    expect(check({ change: { kind: "disable" } })).toBeNull();
    expect(check({ target: { ...admin, id: "a2" }, change: { kind: "role", to: "STAFF" }, activeAdmins: 2 })).toBeNull();
  });

  it("stops an admin demoting or disabling themself", () => {
    expect(check({ target: admin, change: { kind: "role", to: "STAFF" }, activeAdmins: 3 })).toMatch(/own role/);
    expect(check({ target: admin, change: { kind: "disable" }, activeAdmins: 3 })).toMatch(/own account/);
  });

  it("never demotes or disables the last active admin", () => {
    const other = { ...admin, id: "a2" };
    expect(check({ actorId: "a1", target: other, change: { kind: "role", to: "STAFF" }, activeAdmins: 1 })).toMatch(/last active admin/);
    expect(check({ actorId: "a1", target: other, change: { kind: "role", to: "CUSTOMER" }, activeAdmins: 1 })).toMatch(/last active admin/);
    expect(check({ actorId: "a1", target: other, change: { kind: "disable" }, activeAdmins: 1 })).toMatch(/last active admin/);
  });

  it("allows changes to a disabled admin, and enabling anyone", () => {
    const disabledAdmin = { ...admin, id: "a2", isDisabled: true };
    expect(check({ target: disabledAdmin, change: { kind: "role", to: "STAFF" }, activeAdmins: 1 })).toBeNull();
    expect(check({ target: disabledAdmin, change: { kind: "enable" }, activeAdmins: 1 })).toBeNull();
  });

  it("treats a no-op as allowed", () => {
    expect(check({ target: admin, change: { kind: "role", to: "ADMIN" }, activeAdmins: 1 })).toBeNull();
  });
});
