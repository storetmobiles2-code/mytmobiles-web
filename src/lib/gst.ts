/**
 * GST helpers for GST-inclusive B2C pricing.
 *
 * For a GST-inclusive amount A at rate r (basis points):
 *   taxable = A × 10000 / (10000 + r), tax = A − taxable.
 * Intra-state supplies split tax equally into CGST + SGST; inter-state supplies
 * carry IGST. Rounding is done per line to the paisa, and CGST/SGST are split so
 * that they always sum exactly to the line tax.
 */

export interface TaxBreakup {
  taxableValue: number;
  taxAmount: number;
}

export function splitInclusive(amountInclusive: number, rateBps: number): TaxBreakup {
  if (amountInclusive < 0) throw new Error("Amount cannot be negative");
  if (rateBps < 0) throw new Error("GST rate cannot be negative");
  const taxableValue = Math.round((amountInclusive * 10000) / (10000 + rateBps));
  return { taxableValue, taxAmount: amountInclusive - taxableValue };
}

export interface GstComponents {
  cgst: number;
  sgst: number;
  igst: number;
}

export function componentsFor(taxAmount: number, isInterState: boolean): GstComponents {
  if (isInterState) return { cgst: 0, sgst: 0, igst: taxAmount };
  const cgst = Math.floor(taxAmount / 2);
  return { cgst, sgst: taxAmount - cgst, igst: 0 };
}

export function normaliseState(state: string): string {
  return state.trim().toLowerCase().replace(/\s+/g, " ").replace(/&/g, "and");
}

/** If the store's dispatch state is unknown we must not under-declare: treat as inter-state (IGST). */
export function isInterStateSupply(originState: string, destinationState: string): boolean {
  if (!originState.trim()) return true;
  return normaliseState(originState) !== normaliseState(destinationState);
}

export function formatRate(rateBps: number): string {
  const pct = rateBps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/** GSTIN: 2-digit state code, 10-char PAN, entity digit, 'Z', checksum. */
export const GSTIN_PATTERN = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Validates the GSTIN check digit (mod-36 Luhn variant used by GSTN). */
export function isValidGstin(gstin: string): boolean {
  const value = gstin.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(value)) return false;
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = chars.indexOf(value[i]);
    const product = code * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const check = chars[(36 - (sum % 36)) % 36];
  return check === value[14];
}
