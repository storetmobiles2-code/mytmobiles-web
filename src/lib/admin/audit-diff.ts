/**
 * Helpers for audit-log entries: before/after diffs and how to show them.
 * Pure, so they run in the CLI, the admin pages and unit tests.
 */

export type AuditChanges = Record<string, { before: unknown; after: unknown }>;

/** Never stored in an audit entry, whatever the caller passes. */
const SECRET_KEY = /password|passwd|secret|token|hash|otp|totp|apikey|api_key|session/i;
const MAX_STRING = 300;
const MAX_JSON = 1500;

function normalise(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (v === undefined || v === "") return null;
  if (typeof v === "string" && v.length > MAX_STRING) return `${v.slice(0, MAX_STRING - 1)}…`;
  if (v && typeof v === "object") {
    // Spec sheets and similar: keep the row small; the full value is in the product file / database.
    const json = JSON.stringify(v);
    if (json.length > MAX_JSON) return `${json.slice(0, MAX_STRING - 1)}…`;
  }
  return v;
}

/** Compares full values (never the trimmed ones): Dates by instant, "" and undefined as null. */
const comparable = (v: unknown) => (v instanceof Date ? v.toISOString() : v === undefined || v === "" ? null : v);
const same = (a: unknown, b: unknown) => JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));

export function isSecretField(field: string): boolean {
  return SECRET_KEY.test(field);
}

/**
 * Before/after for the fields that changed. Only `fields` (default: every key
 * of `after`) are compared; secret-looking fields are always left out.
 * Returns null when nothing changed.
 */
export function diffChanges(before: object | null | undefined, after: object, fields?: string[]): AuditChanges | null {
  const out: AuditChanges = {};
  const from = (before ?? {}) as Record<string, unknown>;
  const to = after as Record<string, unknown>;
  for (const key of fields ?? Object.keys(to)) {
    if (isSecretField(key)) continue;
    const a = from[key];
    const b = to[key];
    if (!same(a, b)) out[key] = { before: normalise(a), after: normalise(b) };
  }
  return Object.keys(out).length ? out : null;
}

/** Drops secret-looking fields and trims long strings from changes built by hand. */
export function cleanChanges(changes: AuditChanges | null | undefined): AuditChanges | null {
  if (!changes) return null;
  const out: AuditChanges = {};
  for (const [k, v] of Object.entries(changes)) {
    if (isSecretField(k)) continue;
    out[k] = { before: normalise(v.before), after: normalise(v.after) };
  }
  return Object.keys(out).length ? out : null;
}

/** Fields stored in paise, shown as ₹. A prefix like "SKU123.price" also matches. */
const MONEY_FIELDS = new Set(["price", "mrp", "priceFrom", "mrpFrom", "maxDiscount", "minOrderValue", "freeShippingThreshold", "shippingFee", "codFee", "codMaxOrderValue", "total", "amount", "refundedAmount"]);

export function isMoneyField(field: string): boolean {
  return MONEY_FIELDS.has(field.split(".").pop() ?? field);
}

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && isMoneyField(field)) return inr(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length ? value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ") : "none";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Where an entry's entity lives in the admin, if anywhere. */
export function auditEntityHref(entityType: string, entityId: string | null): string | null {
  switch (entityType) {
    case "order":
      return entityId ? `/admin/orders/${entityId}` : null;
    case "product":
      return entityId ? `/admin/products/${entityId}` : null;
    case "user":
      return entityId ? `/admin/customers/${entityId}` : null;
    case "staff":
      return "/admin/staff";
    case "coupon":
      return "/admin/coupons";
    case "banner":
      return "/admin/banners";
    case "category":
    case "brand":
      return "/admin/categories";
    case "review":
      return "/admin/reviews";
    case "settings":
      return "/admin/settings";
    case "stock_import":
      return "/admin/inventory";
    default:
      return null;
  }
}
