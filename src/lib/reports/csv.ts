/**
 * CSV writer for accountant exports. Output is UTF-8 with a byte-order mark so
 * Excel shows ₹ and Indian names correctly, uses CRLF line endings (RFC 4180)
 * and quotes any field that needs it.
 */

export type CsvCell = string | number | null | undefined;

const BOM = "﻿";
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * Quotes a field when it holds a comma, quote, line break or edge spaces.
 * Text starting with = + - @ is prefixed with ' so spreadsheets don't run it
 * as a formula (customer names and addresses are typed by shoppers).
 */
export function csvField(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s) || s !== s.trim()) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: readonly string[], rows: readonly CsvCell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvField).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Paise → "1234.50" (no grouping, always two decimals), as the GST offline tool expects. */
export function paiseToDecimal(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.round(paise));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Basis points → "18.00". */
export function rateToDecimal(rateBps: number): string {
  return paiseToDecimal(rateBps);
}
