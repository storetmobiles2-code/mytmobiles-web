/**
 * What each admin role may do. Pure data, so it is safe in client components
 * and unit tests.
 *
 * ADMIN is the owner and has every permission. STAFF run day-to-day
 * fulfilment: they see the dashboard and orders, move orders along, add
 * shipping/AWB details and notes, print invoices and packing slips, cancel
 * orders that have no captured online payment, look at products and inventory
 * without changing them, moderate reviews and answer consumer complaints.
 *
 * Money stays with ADMIN: prices, MRP, stock levels, catalogue, coupons,
 * banners, settings, refunds (which includes receiving a return, because that
 * starts a refund) and cancelling a paid online order. Customer records,
 * analytics revenue, GST reports, staff and the activity log are ADMIN only too.
 */
import type { Role } from "@/generated/prisma/enums";

export const PERMISSIONS = [
  "dashboard.view",
  "orders.view",
  /** Forward status changes, shipping/AWB details and order notes */
  "orders.update",
  /** Tax invoices and packing slips */
  "orders.print",
  /** Cancel an order that has no captured online payment (no money moves) */
  "orders.cancel",
  /** Receive returns, mark refunds done, cancel paid online orders */
  "orders.refund",
  /** Products and inventory, read-only */
  "products.view",
  /** Product details, variants, prices, MRP, status, images, 360° spins */
  "products.edit",
  "inventory.adjust",
  "inventory.import",
  /** Categories and brands */
  "categories.manage",
  "coupons.manage",
  "banners.manage",
  "settings.manage",
  "reviews.moderate",
  /** Customer list, profiles and contact details beyond a single order */
  "customers.view",
  /** Disable or enable customer accounts */
  "customers.manage",
  /** Analytics and revenue figures */
  "analytics.view",
  /** GST (GSTR-1) report, sales summary and exports */
  "reports.view",
  /** Consumer complaints: view, update status, reply (E-Commerce Rules, 2020) */
  "grievances.manage",
  "staff.manage",
  /** Admin → Activity and History panels */
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STAFF_PERMISSIONS: readonly Permission[] = [
  "dashboard.view",
  "orders.view",
  "orders.update",
  "orders.print",
  "orders.cancel",
  "products.view",
  "reviews.moderate",
  "grievances.manage",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  STAFF: STAFF_PERMISSIONS,
  CUSTOMER: [],
};

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin (owner)", STAFF: "Staff", CUSTOMER: "Customer" };

/** Roles that can open /admin at all. */
export const ADMIN_AREA_ROLES: readonly Role[] = ["ADMIN", "STAFF"];

export function canAccessAdmin(role: Role | null | undefined): boolean {
  return !!role && ADMIN_AREA_ROLES.includes(role);
}

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: Role | null | undefined): Permission[] {
  return role ? [...ROLE_PERMISSIONS[role]] : [];
}

/**
 * Cancelling an order that was paid online sends money back, so it needs
 * `orders.refund` as well as `orders.cancel`.
 */
export function cancelPermissions(order: { paymentMethod: string; paymentStatus: string }): [Permission, ...Permission[]] {
  return order.paymentMethod === "RAZORPAY" && order.paymentStatus === "PAID" ? ["orders.cancel", "orders.refund"] : ["orders.cancel"];
}

/** Receiving a return restocks it and starts a refund, so it is a refund action. */
export function statusChangePermission(to: string): Permission {
  return to === "RETURNED" ? "orders.refund" : "orders.update";
}
