/** Money helpers. All amounts are integer paise. */

const wholeRupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const withPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,49,900 — drops ".00" for whole-rupee amounts. */
export function formatINR(paise: number): string {
  return paise % 100 === 0 ? wholeRupees.format(paise / 100) : withPaise.format(paise / 100);
}

/** Always two decimals — for invoices and tax breakups. */
export function formatINRExact(paise: number): string {
  return withPaise.format(paise / 100);
}

export function rupeesToPaise(rupees: number | string): number {
  const n = typeof rupees === "string" ? Number(rupees.replace(/[,₹\s]/g, "")) : rupees;
  if (!Number.isFinite(n)) throw new Error(`Invalid rupee amount: ${rupees}`);
  return Math.round(n * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Whole-number discount percentage off MRP (floored, as retailers display). */
export function discountPercent(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.floor(((mrp - price) / mrp) * 100);
}
