import { randomInt } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I for phone support readability

/** e.g. MYT-261003-7KQ2XD — date-prefixed for support, random suffix so order volume isn't leaked. */
export function generateOrderNumber(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const ymd = ist.toISOString().slice(2, 10).replace(/-/g, "");
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `MYT-${ymd}-${suffix}`;
}

/** Indian financial year (Apr–Mar) label, e.g. "2627" for FY 2026-27. */
export function financialYear(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(2)}${String(start + 1).slice(2)}`;
}

/**
 * GST invoice numbers must be unique per financial year, consecutive, and at
 * most 16 characters (Rule 46, CGST Rules). Format: PREFIX/FY/NNNNNN.
 */
export function formatInvoiceNumber(prefix: string, fy: string, seq: number): string {
  const p = prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4) || "INV";
  const n = String(seq).padStart(6, "0");
  const out = `${p}/${fy}/${n}`;
  if (out.length > 16) throw new Error(`Invoice number exceeds 16 characters: ${out}`);
  return out;
}
