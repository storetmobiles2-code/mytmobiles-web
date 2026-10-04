/** RFC 4180 CSV parsing (quoted fields, embedded commas/newlines, "" escapes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export interface StockRow {
  name: string;
  /** Selling price in paise */
  price: number;
  quantity: number;
  category: string;
  line: number;
}

export interface StockParseResult {
  rows: StockRow[];
  errors: { line: number; message: string }[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Parses the store's stock export: columns "Name", "Selling Price",
 * "Stock Quantity" (e.g. "3.0 PCS"), "Item Category Name". Header order is
 * detected, so re-ordered exports still work.
 */
export function parseStockCsv(text: string): StockParseResult {
  const table = parseCsv(text);
  const errors: StockParseResult["errors"] = [];
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: "The file is empty." }] };
  const header = table[0].map(norm);
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iName = col("name", "itemname", "productname");
  const iPrice = col("sellingprice", "price", "saleprice");
  const iQty = col("stockquantity", "stock", "quantity", "qty");
  const iCat = col("itemcategoryname", "category", "categoryname");
  if (iName < 0 || iPrice < 0 || iQty < 0) {
    return { rows: [], errors: [{ line: 1, message: 'Header must include "Name", "Selling Price" and "Stock Quantity".' }] };
  }
  const rows: StockRow[] = [];
  table.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const name = (r[iName] ?? "").replace(/\s+/g, " ").trim();
    if (!name) return;
    const price = Number((r[iPrice] ?? "").replace(/[₹,\s]/g, ""));
    const qty = Number((r[iQty] ?? "").replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(price) || price < 0) return void errors.push({ line, message: `Invalid price "${r[iPrice]}" for ${name}` });
    if (!Number.isFinite(qty)) return void errors.push({ line, message: `Invalid stock quantity "${r[iQty]}" for ${name}` });
    rows.push({ name, price: Math.round(price * 100), quantity: Math.max(0, Math.floor(qty)), category: iCat >= 0 ? (r[iCat] ?? "").trim() : "", line });
  });
  return { rows, errors };
}
