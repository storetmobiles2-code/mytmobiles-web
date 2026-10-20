import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { computeInvoiceTax } from "@/lib/pricing";
import { csvField, paiseToDecimal, toCsv } from "@/lib/reports/csv";
import { crc32, createZip } from "@/lib/reports/zip";
import {
  B2CL_THRESHOLD,
  buildGstr1Report,
  formatGstDate,
  GSTR1_HEADERS,
  gstr1Files,
  invoiceTaxLines,
  parseMonth,
  placeOfSupply,
  reportMonth,
  type Gstr1Order,
} from "@/lib/reports/gstr1";

const STORE = { gstin: "36AAPFU0939F1Z5", state: "Telangana" };
const OCT = reportMonth(2026, 10);

interface Line {
  price: number;
  qty?: number;
  rate?: number;
  hsn?: string;
}

/** Builds an order the way checkout does: line taxes plus a fee line at the principal rate. */
function order(n: number, lines: Line[], o: Partial<Gstr1Order> & { state?: string; invoicedAt?: Date | null } = {}): Gstr1Order {
  const state = o.state ?? "Telangana";
  const isInterState = state !== STORE.state;
  const items = lines.map((l) => ({ hsn: l.hsn ?? "85171300", rate: l.rate ?? 1800, qty: l.qty ?? 1, value: l.price * (l.qty ?? 1) }));
  const shippingFee = o.shippingFee ?? 0;
  const codFee = o.codFee ?? 0;
  const tax = computeInvoiceTax(
    [...items.map((i) => ({ amountInclusive: i.value, gstRateBps: i.rate })), { amountInclusive: shippingFee + codFee, gstRateBps: Math.max(...items.map((i) => i.rate)) }],
    isInterState,
  );
  const subtotal = items.reduce((s, i) => s + i.value, 0);
  const invoicedAt = o.invoicedAt === undefined ? new Date("2026-10-10T06:00:00Z") : o.invoicedAt;
  return {
    orderNumber: `MYT-261010-ORD${n}`,
    status: "DELIVERED",
    paymentMethod: "COD",
    paymentStatus: "PAID",
    shipName: `Buyer ${n}`,
    buyerCompany: null,
    buyerGstin: null,
    shipState: state,
    isInterState,
    subtotal,
    couponDiscount: 0,
    shippingFee,
    codFee,
    total: subtotal + shippingFee + codFee,
    taxableValue: tax.taxableValue,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    invoiceNumber: invoicedAt ? `MYT/2627/${String(n).padStart(6, "0")}` : null,
    invoicedAt,
    placedAt: new Date("2026-10-08T06:00:00Z"),
    cancelledAt: null,
    returnedAt: null,
    refundedAmount: 0,
    items: items.map((i, k) => ({ productName: `Item ${k}`, hsnCode: i.hsn, gstRateBps: i.rate, quantity: i.qty, taxableValue: tax.lines[k].taxableValue, taxAmount: tax.lines[k].taxAmount })),
    ...o,
  };
}

const intra = order(1, [{ price: 13_499_00 }]);
const multiRate = order(2, [{ price: 20_000_00 }, { price: 999_00, rate: 500, hsn: "85044030" }], { state: "Karnataka", shippingFee: 49_00, paymentMethod: "RAZORPAY" });
const cancelled = order(3, [{ price: 9_999_00 }], { state: "Karnataka", status: "CANCELLED", cancelledAt: new Date("2026-10-12T06:00:00Z") });
const large = order(4, [{ price: 1_29_999_00 }], { state: "Maharashtra" });
const atThreshold = order(5, [{ price: B2CL_THRESHOLD }], { state: "Karnataka" });
const b2b = order(6, [{ price: 1_49_900_00 }], { state: "Maharashtra", buyerGstin: "27AAPFU0939F1ZV", buyerCompany: "Acme, \"Traders\" Pvt Ltd" });
const rounding = order(7, [{ price: 999_00, qty: 3 }, { price: 1_00 }], { codFee: 1_00 });
const firstMinute = order(8, [{ price: 5_000_00 }], { invoicedAt: new Date("2026-09-30T18:30:00Z") });
const lastSeptMinute = order(9, [{ price: 5_000_00 }], { invoicedAt: new Date("2026-09-30T18:29:59Z") });
const unpaid = order(10, [{ price: 15_000_00 }], { invoicedAt: null, paymentMethod: "RAZORPAY", paymentStatus: "FAILED", status: "CANCELLED", cancelledAt: new Date("2026-10-08T07:00:00Z") });
const returned = order(11, [{ price: 30_000_00 }], {
  invoicedAt: new Date("2026-09-20T06:00:00Z"),
  placedAt: new Date("2026-09-18T06:00:00Z"),
  status: "RETURNED",
  paymentStatus: "REFUND_PENDING",
  returnedAt: new Date("2026-10-03T06:00:00Z"),
});

const ALL = [intra, multiRate, cancelled, large, atThreshold, b2b, rounding, firstMinute, lastSeptMinute, unpaid, returned];
const report = buildGstr1Report(ALL, OCT, STORE);

describe("month handling", () => {
  it("uses IST month boundaries", () => {
    expect(OCT.start.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(OCT.end.toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(OCT.label).toBe("October 2026");
  });
  it("parses YYYY-MM and falls back to the current month", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    expect(parseMonth("2026-08", now).key).toBe("2026-08");
    expect(parseMonth("2026-13", now).key).toBe("2026-10");
    expect(parseMonth("2027-01", now).key).toBe("2026-10");
    expect(parseMonth(undefined, now).key).toBe("2026-10");
    // 31 Oct 20:00 UTC is already 1 Nov in India.
    expect(parseMonth(null, new Date("2026-10-31T20:00:00Z")).key).toBe("2026-11");
  });
  it("formats dates as dd-MMM-yyyy in IST", () => {
    expect(formatGstDate(new Date("2026-09-30T18:30:00Z"))).toBe("01-Oct-2026");
    expect(formatGstDate(new Date("2026-09-30T18:29:59Z"))).toBe("30-Sep-2026");
  });
  it("labels place of supply with the GST state code", () => {
    expect(placeOfSupply("Telangana").label).toBe("36-Telangana");
    expect(placeOfSupply("NEW DELHI").label).toBe("07-Delhi");
    expect(placeOfSupply("Ladakh").code).toBe("38");
  });
});

describe("invoice selection", () => {
  const numbers = new Set(report.register.map((r) => r.invoiceNumber));
  it("takes invoices by invoice date, not order date", () => {
    expect(numbers.has(firstMinute.invoiceNumber!)).toBe(true);
    expect(numbers.has(lastSeptMinute.invoiceNumber!)).toBe(false);
    expect(numbers.has(returned.invoiceNumber!)).toBe(false);
  });
  it("leaves out orders that never got an invoice", () => {
    expect(report.register.some((r) => r.orderNumber === unpaid.orderNumber)).toBe(false);
  });
  it("keeps cancelled invoices in the register but not in the totals", () => {
    const row = report.register.find((r) => r.invoiceNumber === cancelled.invoiceNumber)!;
    expect(row.cancelled).toBe(true);
    expect(report.totals.cancelledInvoices).toBe(1);
    expect(report.totals.invoices).toBe(7);
    const active = [intra, multiRate, large, atThreshold, b2b, rounding, firstMinute];
    expect(report.totals.taxable).toBe(active.reduce((s, o) => s + o.taxableValue, 0));
    expect(report.totals.igst).toBe(active.reduce((s, o) => s + o.igst, 0));
    expect(report.totals.cgst).toBe(active.reduce((s, o) => s + o.cgst, 0));
    expect(report.totals.sgst).toBe(active.reduce((s, o) => s + o.sgst, 0));
    expect(report.totals.invoiceValue).toBe(active.reduce((s, o) => s + o.total, 0));
  });
  it("has no consistency warnings for orders built like checkout", () => {
    expect(report.warnings).toEqual([]);
  });
});

describe("tax split", () => {
  it("uses CGST + SGST within the state", () => {
    const row = report.register.find((r) => r.invoiceNumber === intra.invoiceNumber)!;
    expect(row.igst).toBe(0);
    expect(row.cgst + row.sgst).toBe(13_499_00 - row.taxable);
    expect(row.total).toBe(13_499_00);
  });
  it("uses IGST between states", () => {
    const rows = report.register.filter((r) => r.invoiceNumber === multiRate.invoiceNumber);
    expect(rows.every((r) => r.cgst === 0 && r.sgst === 0 && r.igst > 0)).toBe(true);
  });
  it("splits a multi-rate invoice into one row per rate and puts shipping at the principal rate", () => {
    const rows = report.register.filter((r) => r.invoiceNumber === multiRate.invoiceNumber);
    expect(rows.map((r) => r.rateBps)).toEqual([1800, 500]);
    expect(rows[0].total).toBe(20_000_00 + 49_00);
    expect(rows[1].total).toBe(999_00);
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(multiRate.total);
    expect(rows[0].invoiceValue).toBe(multiRate.total);
  });
  it("rounds per line to the paisa and splits odd tax so CGST + SGST = tax", () => {
    const lines = invoiceTaxLines(rounding);
    // ₹2,997 @18%: taxable round(299700 × 10000 / 11800) = 253983, tax 45717 → 22858 + 22859.
    expect(lines[0]).toMatchObject({ taxable: 2_539_83, tax: 457_17, cgst: 228_58, sgst: 228_59, igst: 0 });
    // ₹1 @18% and the ₹1 COD fee: 85 paise taxable, 15 paise tax each.
    expect(lines[1]).toMatchObject({ taxable: 85, tax: 15, cgst: 7, sgst: 8 });
    expect(lines[2]).toMatchObject({ quantity: 0, taxable: 85, tax: 15 });
    const row = report.register.find((r) => r.invoiceNumber === rounding.invoiceNumber)!;
    expect(row.taxable + row.cgst + row.sgst).toBe(rounding.total);
  });
});

describe("GSTR-1 tables", () => {
  it("puts inter-state B2C invoices above ₹1 lakh in B2CL, and exactly ₹1 lakh in B2CS", () => {
    expect(report.b2cl.map((r) => r.invoiceNumber)).toEqual([large.invoiceNumber]);
    expect(report.b2cl[0]).toMatchObject({ placeOfSupply: "27-Maharashtra", rateBps: 1800, invoiceValue: 1_29_999_00 });
    expect(report.b2cs.some((r) => r.placeOfSupply === "29-Karnataka" && r.rateBps === 1800)).toBe(true);
  });
  it("consolidates B2CS by place of supply and rate", () => {
    const ka18 = report.b2cs.find((r) => r.placeOfSupply === "29-Karnataka" && r.rateBps === 1800)!;
    const mrLines = invoiceTaxLines(multiRate).filter((l) => l.rateBps === 1800);
    expect(ka18.invoices).toBe(2);
    expect(ka18.taxable).toBe(mrLines.reduce((s, l) => s + l.taxable, 0) + atThreshold.taxableValue);
    expect(report.b2cs.map((r) => `${r.placeOfSupply} ${r.rateBps}`)).toEqual(["29-Karnataka 1800", "29-Karnataka 500", "36-Telangana 1800"]);
    const ts = report.b2cs.find((r) => r.placeOfSupply === "36-Telangana")!;
    expect(ts.igst).toBe(0);
    expect(ts.invoices).toBe(3);
  });
  it("puts invoices with a buyer GSTIN in B2B", () => {
    expect(report.b2b).toHaveLength(1);
    expect(report.b2b[0]).toMatchObject({ gstin: "27AAPFU0939F1ZV", placeOfSupply: "27-Maharashtra", taxable: b2b.taxableValue });
  });
  it("splits the HSN summary into B2B and B2C, and it matches the other tables", () => {
    const sum = (rows: { taxable: number }[]) => rows.reduce((s, r) => s + r.taxable, 0);
    expect(sum(report.hsnB2b)).toBe(sum(report.b2b));
    expect(sum(report.hsnB2c)).toBe(sum(report.b2cs) + sum(report.b2cl));
    const phones = report.hsnB2c.find((h) => h.hsn === "85171300" && h.rateBps === 1800)!;
    expect(phones.uqc).toBe("NOS-NUMBERS");
    // 1 + 1 + 1 + 1 + (3 + 1) + 1 units; fee lines add value but no quantity.
    expect(phones.quantity).toBe(9);
    expect(report.hsnB2c.find((h) => h.hsn === "85044030")).toMatchObject({ rateBps: 500, quantity: 1, totalValue: 999_00 });
  });
  it("lists the invoice series in Table 13 with cancelled invoices counted", () => {
    expect(report.docs).toEqual([
      { nature: "Invoices for outward supply", from: "MYT/2627/000001", to: "MYT/2627/000008", totalNumber: 8, cancelled: 1, missing: [] },
    ]);
  });
  it("counts gaps in the series as cancelled and warns", () => {
    const r = buildGstr1Report([intra, large], OCT, STORE);
    expect(r.docs[0]).toMatchObject({ from: "MYT/2627/000001", to: "MYT/2627/000004", totalNumber: 4, cancelled: 2, missing: ["MYT/2627/000002", "MYT/2627/000003"] });
    expect(r.warnings.join(" ")).toMatch(/2 number\(s\)/);
  });
  it("lists returns and post-payment cancellations in the month as refunds", () => {
    expect(report.refunds).toHaveLength(1);
    expect(report.refunds[0]).toMatchObject({ orderNumber: returned.orderNumber, event: "Returned", amount: 30_000_00, taxable: returned.taxableValue });
    expect(report.refunds[0].note).toMatch(/No credit note/);
  });
  it("warns about a cancellation after the month and settings gaps", () => {
    const late = { ...cancelled, cancelledAt: new Date("2026-11-03T06:00:00Z") };
    const r = buildGstr1Report([late], OCT, { gstin: "", state: "" });
    expect(r.warnings).toHaveLength(3);
  });
});

describe("sales summary", () => {
  it("counts orders placed in the month, leaving out unpaid online orders", () => {
    const s = report.sales;
    expect(s.unpaidOnline).toBe(1);
    expect(s.orders).toBe(9);
    expect(s.cancelled).toBe(1);
    expect(s.netOrders).toBe(8);
    expect(s.shipping).toBe(49_00);
    expect(s.codFees).toBe(1_00);
    expect(s.online).toEqual({ orders: 1, amount: multiRate.total });
    expect(s.revenue).toBe(s.cod.amount + s.online.amount);
    expect(s.revenue).toBe(s.itemsValue - s.discounts + s.shipping + s.codFees);
    expect(s.refunds).toEqual({ count: 1, amount: 30_000_00 });
  });
});

describe("CSV export", () => {
  const files = Object.fromEntries(gstr1Files(report, STORE).map((f) => [f.name, f.content]));
  it("writes UTF-8 with a BOM and the offline tool's headers", () => {
    expect(files["b2cs.csv"].startsWith("﻿Type,Place Of Supply,Applicable % of Tax Rate,Rate,Taxable Value,Cess Amount,E-Commerce GSTIN\r\n")).toBe(true);
    expect(files["docs.csv"]).toContain("Nature of Document,Sr. No. From,Sr. No. To,Total Number,Cancelled\r\nInvoices for outward supply,MYT/2627/000001,MYT/2627/000008,8,1\r\n");
    expect(files["hsn_b2c.csv"].split("\r\n")[0]).toBe(`﻿${GSTR1_HEADERS.hsn.join(",")}`);
    expect(Object.keys(files)).toEqual(["register.csv", "b2b.csv", "b2cl.csv", "b2cs.csv", "hsn_b2b.csv", "hsn_b2c.csv", "docs.csv", "refunds.csv", "summary.csv"]);
  });
  it("formats amounts in rupees with two decimals and dates as dd-MMM-yyyy", () => {
    expect(files["b2cl.csv"]).toContain(`${large.invoiceNumber},10-Oct-2026,129999.00,27-Maharashtra,,18.00,${paiseToDecimal(large.taxableValue)},,\r\n`);
    expect(files["b2cs.csv"]).toContain("OE,29-Karnataka,,5.00,");
  });
  it("quotes names with commas and quotes", () => {
    expect(files["b2b.csv"]).toContain(`27AAPFU0939F1ZV,"Acme, ""Traders"" Pvt Ltd",${b2b.invoiceNumber},10-Oct-2026,149900.00,27-Maharashtra,N,,Regular B2B,,18.00,`);
  });
});

describe("csv helpers", () => {
  it("guards against spreadsheet formulas but keeps numbers", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("-12.50")).toBe("-12.50");
    expect(csvField(" padded")).toBe('" padded"');
    expect(csvField("a\nb")).toBe('"a\nb"');
    expect(toCsv(["a"], [[null]])).toBe("﻿a\r\n\r\n");
  });
  it("formats paise without floating-point error", () => {
    expect(paiseToDecimal(1_00_000_05)).toBe("100000.05");
    expect(paiseToDecimal(7)).toBe("0.07");
    expect(paiseToDecimal(-150)).toBe("-1.50");
  });
});

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("writes entries that inflate back to the original text", () => {
    const zip = createZip([{ name: "a.csv", data: "﻿x,y\r\n₹,1\r\n" }, { name: "b.txt", data: "hello" }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocd = zip.byteLength - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(2);
    // First local header
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const packed = view.getUint32(18, true);
    const nameLen = view.getUint16(26, true);
    expect(new TextDecoder().decode(zip.slice(30, 30 + nameLen))).toBe("a.csv");
    const data = inflateRawSync(zip.slice(30 + nameLen, 30 + nameLen + packed));
    expect(data.toString("utf8")).toBe("﻿x,y\r\n₹,1\r\n");
    expect(view.getUint32(14, true)).toBe(crc32(new Uint8Array(data)));
  });
});
