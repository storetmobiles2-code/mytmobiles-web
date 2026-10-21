/**
 * Monthly GSTR-1 workings and sales summary for the accountant.
 *
 * Pure: takes order snapshots and a month, returns the invoice register and the
 * GSTR-1 tables. Invoices are picked by invoice date (Indian Standard Time).
 * All sums are integer paise; formatting to two decimals happens only in the
 * CSV writers at the bottom.
 *
 * Tax maths match the invoice: each order line keeps the taxable value and tax
 * stored at checkout, and delivery/COD charges form one extra line taxed at the
 * principal item's rate and HSN (composite supply), split with `splitInclusive`.
 * CGST/SGST are split per line with `componentsFor`, exactly as on the invoice.
 *
 * Column headers and order of the CSVs follow the field lists of the GSTN
 * Returns Offline Tool (user manual, sections 2.1–2.20).
 */
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { componentsFor, isValidGstin, splitInclusive } from "@/lib/gst";
import { canonicalState, stateCode } from "@/lib/indian-states";
import { paiseToDecimal, rateToDecimal, toCsv } from "./csv";

/**
 * Inter-state B2C invoices with a value above ₹1 lakh go invoice-wise into
 * Table 5 (B2CL); everything else B2C is consolidated in Table 7 (B2CS).
 * Threshold lowered from ₹2.5 lakh by Notification 12/2024–Central Tax,
 * from the August 2024 return period.
 */
export const B2CL_THRESHOLD = 1_00_000_00;
/** Unit Quantity Code for phones, TVs and appliances sold by the piece. */
export const UQC = "NOS-NUMBERS";
export const DOC_NATURE_INVOICE = "Invoices for outward supply";

const IST_OFFSET = 5.5 * 3600_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Month handling ───────────────────────────────────────────────────────────

export interface ReportMonth {
  /** "2026-10" */
  key: string;
  year: number;
  /** 1–12 */
  month: number;
  /** First instant of the month in IST, inclusive. */
  start: Date;
  /** First instant of the next month in IST, exclusive. */
  end: Date;
  /** "October 2026" */
  label: string;
}

export function reportMonth(year: number, month: number): ReportMonth {
  const start = new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET);
  const end = new Date(Date.UTC(year, month, 1) - IST_OFFSET);
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  return { key: `${year}-${String(month).padStart(2, "0")}`, year, month, start, end, label };
}

/** The IST calendar month containing `now`. */
export function currentMonth(now = new Date()): ReportMonth {
  const ist = new Date(now.getTime() + IST_OFFSET);
  return reportMonth(ist.getUTCFullYear(), ist.getUTCMonth() + 1);
}

/** Parses "YYYY-MM"; anything else (or a future month) falls back to the current month. */
export function parseMonth(input: unknown, now = new Date()): ReportMonth {
  const current = currentMonth(now);
  if (typeof input !== "string") return current;
  const m = /^(\d{4})-(\d{2})$/.exec(input.trim());
  if (!m) return current;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2017) return current;
  const parsed = reportMonth(year, month);
  return parsed.start > current.start ? current : parsed;
}

function inMonth(d: Date | null, m: ReportMonth): d is Date {
  return d !== null && d >= m.start && d < m.end;
}

/** dd-MMM-yyyy in IST, the date format the GST offline tool accepts (e.g. 05-Oct-2026). */
export function formatGstDate(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET);
  return `${String(ist.getUTCDate()).padStart(2, "0")}-${MONTHS[ist.getUTCMonth()]}-${ist.getUTCFullYear()}`;
}

/** "36-Telangana", as the offline tool's Place Of Supply list writes it. */
export function placeOfSupply(state: string): { name: string; code: string | null; label: string } {
  const name = canonicalState(state) ?? state.trim();
  const code = stateCode(name);
  return { name, code, label: code ? `${code}-${name}` : name };
}

// ── Input ────────────────────────────────────────────────────────────────────

export interface Gstr1OrderItem {
  productName: string;
  hsnCode: string;
  gstRateBps: number;
  quantity: number;
  /** GST-exclusive value after discount, as stored on the order line. */
  taxableValue: number;
  taxAmount: number;
}

export interface Gstr1Order {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shipName: string;
  buyerCompany: string | null;
  buyerGstin: string | null;
  shipState: string;
  isInterState: boolean;
  subtotal: number;
  couponDiscount: number;
  shippingFee: number;
  codFee: number;
  total: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  invoiceNumber: string | null;
  invoicedAt: Date | null;
  placedAt: Date;
  cancelledAt: Date | null;
  /** When the order was marked returned (from its RETURNED event). */
  returnedAt: Date | null;
  /** Sum of refunds recorded against the order's payments. */
  refundedAmount: number;
  items: Gstr1OrderItem[];
}

export interface StoreInfo {
  gstin: string;
  state: string;
}

// ── Output ───────────────────────────────────────────────────────────────────

export type Section = "B2B" | "B2CL" | "B2CS";

export interface TaxSums {
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
}

export interface RegisterRow extends TaxSums {
  invoiceNumber: string;
  invoiceDate: Date;
  customerName: string;
  buyerGstin: string | null;
  placeOfSupply: string;
  stateCode: string | null;
  supplyType: "B2B" | "B2C";
  section: Section;
  rateBps: number;
  /** Taxable value + tax at this rate. */
  total: number;
  /** Whole invoice value, repeated on each rate row of a multi-rate invoice. */
  invoiceValue: number;
  paymentMethod: PaymentMethod;
  orderNumber: string;
  status: OrderStatus;
  cancelled: boolean;
}

export interface B2bRow extends TaxSums {
  gstin: string;
  receiverName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  invoiceValue: number;
  placeOfSupply: string;
  rateBps: number;
}

export interface B2clRow extends TaxSums {
  invoiceNumber: string;
  invoiceDate: Date;
  invoiceValue: number;
  placeOfSupply: string;
  rateBps: number;
}

export interface B2csRow extends TaxSums {
  placeOfSupply: string;
  stateCode: string | null;
  rateBps: number;
  invoices: number;
}

export interface HsnRow extends TaxSums {
  hsn: string;
  uqc: string;
  quantity: number;
  /** Taxable value + all tax. */
  totalValue: number;
  rateBps: number;
}

export interface DocsRow {
  nature: string;
  from: string;
  to: string;
  totalNumber: number;
  cancelled: number;
  /** Numbers in the range with no invoice on record (counted as cancelled). */
  missing: string[];
}

export interface RefundRow extends TaxSums {
  orderNumber: string;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  event: "Returned" | "Cancelled after payment";
  eventDate: Date;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amount: number;
  placeOfSupply: string;
  note: string;
}

export interface SalesSummary {
  /** Orders placed in the month, excluding online orders that were never paid. */
  orders: number;
  cancelled: number;
  /** Online orders abandoned before payment (not counted anywhere else). */
  unpaidOnline: number;
  netOrders: number;
  /** Selling price × quantity, before coupon discounts. */
  itemsValue: number;
  discounts: number;
  shipping: number;
  codFees: number;
  /** What customers pay: items − discounts + shipping + COD fees. */
  revenue: number;
  cod: { orders: number; amount: number };
  online: { orders: number; amount: number };
  refunds: { count: number; amount: number };
}

export interface Gstr1Report {
  month: ReportMonth;
  register: RegisterRow[];
  b2b: B2bRow[];
  b2cl: B2clRow[];
  b2cs: B2csRow[];
  hsnB2b: HsnRow[];
  hsnB2c: HsnRow[];
  docs: DocsRow[];
  refunds: RefundRow[];
  /** Active (not cancelled) invoices only. */
  totals: TaxSums & { invoices: number; cancelledInvoices: number; invoiceValue: number };
  sales: SalesSummary;
  warnings: string[];
}

// ── Tax lines ────────────────────────────────────────────────────────────────

export interface TaxLine extends TaxSums {
  hsn: string;
  rateBps: number;
  quantity: number;
  tax: number;
}

/** The invoice's tax lines: one per order line, plus delivery/COD charges at the principal rate. */
export function invoiceTaxLines(o: Pick<Gstr1Order, "items" | "shippingFee" | "codFee" | "isInterState">): TaxLine[] {
  const lines: TaxLine[] = o.items.map((i) => ({
    hsn: i.hsnCode,
    rateBps: i.gstRateBps,
    quantity: i.quantity,
    taxable: i.taxableValue,
    tax: i.taxAmount,
    ...componentsFor(i.taxAmount, o.isInterState),
  }));
  const fees = o.shippingFee + o.codFee;
  if (fees > 0 && o.items.length > 0) {
    const rate = Math.max(...o.items.map((i) => i.gstRateBps));
    const hsn = o.items.find((i) => i.gstRateBps === rate)!.hsnCode;
    const { taxableValue, taxAmount } = splitInclusive(fees, rate);
    lines.push({ hsn, rateBps: rate, quantity: 0, taxable: taxableValue, tax: taxAmount, ...componentsFor(taxAmount, o.isInterState) });
  }
  return lines;
}

function addSums<T extends TaxSums>(target: T, add: TaxSums): T {
  target.taxable += add.taxable;
  target.igst += add.igst;
  target.cgst += add.cgst;
  target.sgst += add.sgst;
  return target;
}

const zero = (): TaxSums => ({ taxable: 0, igst: 0, cgst: 0, sgst: 0 });
const taxOf = (s: TaxSums) => s.igst + s.cgst + s.sgst;

/** Groups tax lines by rate, in descending rate order. */
function byRate(lines: TaxLine[]): (TaxSums & { rateBps: number })[] {
  const map = new Map<number, TaxSums & { rateBps: number }>();
  for (const l of lines) addSums(map.get(l.rateBps) ?? map.set(l.rateBps, { rateBps: l.rateBps, ...zero() }).get(l.rateBps)!, l);
  return [...map.values()].sort((a, b) => b.rateBps - a.rateBps);
}

export function sectionFor(o: Pick<Gstr1Order, "buyerGstin" | "isInterState" | "total">): Section {
  if (o.buyerGstin) return "B2B";
  return o.isInterState && o.total > B2CL_THRESHOLD ? "B2CL" : "B2CS";
}

/** Splits "MYT/2627/000042" into its series ("MYT/2627/") and number (42). */
function splitSeries(invoiceNumber: string): { series: string; seq: number; width: number } {
  const m = /^(.*?)(\d+)$/.exec(invoiceNumber);
  if (!m) return { series: invoiceNumber, seq: NaN, width: 0 };
  return { series: m[1], seq: Number(m[2]), width: m[2].length };
}

// ── Report ───────────────────────────────────────────────────────────────────

export function buildGstr1Report(orders: Gstr1Order[], month: ReportMonth, store: StoreInfo): Gstr1Report {
  const warnings: string[] = [];
  if (!store.gstin) warnings.push("The store GSTIN is not set (Admin → Settings). The accountant needs it to file GSTR-1.");
  if (!store.state) warnings.push("The store's dispatch state is not set (Admin → Settings), so every invoice was billed as inter-state (IGST).");

  const invoiced = orders
    .filter((o) => o.invoiceNumber && inMonth(o.invoicedAt, month))
    .sort((a, b) => a.invoicedAt!.getTime() - b.invoicedAt!.getTime() || a.invoiceNumber!.localeCompare(b.invoiceNumber!));

  const register: RegisterRow[] = [];
  const b2b: B2bRow[] = [];
  const b2cl: B2clRow[] = [];
  const b2csMap = new Map<string, B2csRow & { invoiceSet: Set<string> }>();
  const hsnMaps = { B2B: new Map<string, HsnRow>(), B2C: new Map<string, HsnRow>() };
  const totals = { ...zero(), invoices: 0, cancelledInvoices: 0, invoiceValue: 0 };
  const hsnWarned = new Set<string>();

  for (const o of invoiced) {
    const invoiceNumber = o.invoiceNumber!;
    const invoiceDate = o.invoicedAt!;
    const cancelled = o.status === "CANCELLED";
    const pos = placeOfSupply(o.shipState);
    const section = sectionFor(o);
    const lines = invoiceTaxLines(o);
    const rates = byRate(lines);

    const sum = lines.reduce((s, l) => addSums(s, l), zero());
    if (sum.taxable !== o.taxableValue || sum.igst !== o.igst || sum.cgst !== o.cgst || sum.sgst !== o.sgst) {
      warnings.push(`Invoice ${invoiceNumber}: line-wise tax doesn't add up to the totals stored on the order. Check the invoice before filing.`);
    }
    if (!pos.code) warnings.push(`Invoice ${invoiceNumber}: place of supply "${o.shipState}" has no GST state code.`);
    if (o.buyerGstin && !isValidGstin(o.buyerGstin)) warnings.push(`Invoice ${invoiceNumber}: buyer GSTIN ${o.buyerGstin} fails the checksum.`);
    if (cancelled && o.cancelledAt && o.cancelledAt >= month.end) {
      warnings.push(
        `Invoice ${invoiceNumber} was cancelled on ${formatGstDate(o.cancelledAt)}, after this month ended. It is shown as cancelled here. If this month's GSTR-1 was already filed with it as a sale, ask the accountant how to reverse it.`,
      );
    }

    for (const r of rates) {
      register.push({
        invoiceNumber,
        invoiceDate,
        customerName: o.buyerCompany || o.shipName,
        buyerGstin: o.buyerGstin,
        placeOfSupply: pos.name,
        stateCode: pos.code,
        supplyType: o.buyerGstin ? "B2B" : "B2C",
        section,
        rateBps: r.rateBps,
        taxable: r.taxable,
        igst: r.igst,
        cgst: r.cgst,
        sgst: r.sgst,
        total: r.taxable + taxOf(r),
        invoiceValue: o.total,
        paymentMethod: o.paymentMethod,
        orderNumber: o.orderNumber,
        status: o.status,
        cancelled,
      });
    }

    if (cancelled) {
      totals.cancelledInvoices++;
      continue;
    }
    totals.invoices++;
    totals.invoiceValue += o.total;
    addSums(totals, sum);

    for (const r of rates) {
      if (section === "B2B") {
        b2b.push({ gstin: o.buyerGstin!, receiverName: o.buyerCompany || o.shipName, invoiceNumber, invoiceDate, invoiceValue: o.total, placeOfSupply: pos.label, ...r });
      } else if (section === "B2CL") {
        b2cl.push({ invoiceNumber, invoiceDate, invoiceValue: o.total, placeOfSupply: pos.label, ...r });
      } else {
        const key = `${pos.label}|${r.rateBps}`;
        const row = b2csMap.get(key) ?? b2csMap.set(key, { placeOfSupply: pos.label, stateCode: pos.code, rateBps: r.rateBps, invoices: 0, invoiceSet: new Set(), ...zero() }).get(key)!;
        addSums(row, r);
        row.invoiceSet.add(invoiceNumber);
      }
    }

    const hsnMap = section === "B2B" ? hsnMaps.B2B : hsnMaps.B2C;
    for (const l of lines) {
      const hsn = l.hsn.trim();
      if (!/^\d{4,8}$/.test(hsn) && !hsnWarned.has(hsn)) {
        hsnWarned.add(hsn);
        warnings.push(`HSN "${hsn}" should be 4 to 8 digits (at least 4 digits up to ₹5 crore turnover, 6 above).`);
      }
      if (l.rateBps === 0 && !hsnWarned.has(`nil:${hsn}`)) {
        hsnWarned.add(`nil:${hsn}`);
        warnings.push(`HSN ${hsn} was sold at 0% GST. Nil-rated supplies go in Table 8, which this export doesn't fill.`);
      }
      const key = `${hsn}|${l.rateBps}`;
      const row = hsnMap.get(key) ?? hsnMap.set(key, { hsn, uqc: UQC, quantity: 0, totalValue: 0, rateBps: l.rateBps, ...zero() }).get(key)!;
      addSums(row, l);
      row.quantity += l.quantity;
      row.totalValue += l.taxable + l.tax;
    }
  }

  const b2cs = [...b2csMap.values()]
    .map(({ invoiceSet, ...row }) => ({ ...row, invoices: invoiceSet.size }))
    .sort((a, b) => (a.stateCode ?? "99").localeCompare(b.stateCode ?? "99") || b.rateBps - a.rateBps);
  const sortHsn = (m: Map<string, HsnRow>) => [...m.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || b.rateBps - a.rateBps);

  const docs = documentsIssued(invoiced, warnings);
  const refunds = refundRows(orders, month);
  const sales = salesSummary(orders, month, refunds);

  return { month, register, b2b, b2cl, b2cs, hsnB2b: sortHsn(hsnMaps.B2B), hsnB2c: sortHsn(hsnMaps.B2C), docs, refunds, totals, sales, warnings };
}

/** Table 13: one row per invoice series, counting cancelled invoices and any gaps. */
function documentsIssued(invoiced: Gstr1Order[], warnings: string[]): DocsRow[] {
  const series = new Map<string, { seqs: Map<number, Gstr1Order>; width: number }>();
  for (const o of invoiced) {
    const s = splitSeries(o.invoiceNumber!);
    if (Number.isNaN(s.seq)) {
      warnings.push(`Invoice number ${o.invoiceNumber} doesn't end in a serial number; add it to Table 13 by hand.`);
      continue;
    }
    const entry = series.get(s.series) ?? series.set(s.series, { seqs: new Map(), width: s.width }).get(s.series)!;
    entry.seqs.set(s.seq, o);
    entry.width = Math.max(entry.width, s.width);
  }
  const rows: DocsRow[] = [];
  for (const [prefix, { seqs, width }] of [...series.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const nums = [...seqs.keys()].sort((a, b) => a - b);
    const first = nums[0];
    const last = nums[nums.length - 1];
    const fmt = (n: number) => `${prefix}${String(n).padStart(width, "0")}`;
    const missing: string[] = [];
    for (let n = first; n <= last; n++) if (!seqs.has(n)) missing.push(fmt(n));
    const cancelled = [...seqs.values()].filter((o) => o.status === "CANCELLED").length;
    if (missing.length > 0) {
      warnings.push(`Invoice series ${prefix}: ${missing.length} number(s) in the range have no invoice on record (${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", …" : ""}). They are counted as cancelled in Table 13.`);
    }
    rows.push({ nature: DOC_NATURE_INVOICE, from: fmt(first), to: fmt(last), totalNumber: last - first + 1, cancelled: cancelled + missing.length, missing });
  }
  return rows;
}

/** Returns and post-payment cancellations whose date falls in the month. The store issues no credit notes yet. */
function refundRows(orders: Gstr1Order[], month: ReportMonth): RefundRow[] {
  const rows: RefundRow[] = [];
  for (const o of orders) {
    let event: RefundRow["event"] | null = null;
    let eventDate: Date | null = null;
    if (o.status === "RETURNED") {
      event = "Returned";
      eventDate = o.returnedAt;
    } else if (o.status === "CANCELLED" && (o.paymentStatus === "REFUND_PENDING" || o.paymentStatus === "REFUNDED")) {
      event = "Cancelled after payment";
      eventDate = o.cancelledAt;
    }
    if (!event || !inMonth(eventDate, month)) continue;

    const invoiced = Boolean(o.invoiceNumber);
    const sums = invoiced ? invoiceTaxLines(o).reduce((s, l) => addSums(s, l), zero()) : zero();
    const note = !invoiced
      ? "No invoice was issued, so there is no GST to reverse."
      : event === "Returned"
        ? "Invoice stands. No credit note has been issued for this return."
        : "Invoice cancelled. It is excluded from sales and counted as cancelled in Table 13.";
    rows.push({
      orderNumber: o.orderNumber,
      invoiceNumber: o.invoiceNumber,
      invoiceDate: o.invoicedAt,
      event,
      eventDate: eventDate!,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      amount: o.refundedAmount > 0 ? o.refundedAmount : o.total,
      placeOfSupply: placeOfSupply(o.shipState).label,
      note,
      ...sums,
    });
  }
  return rows.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
}

function isAbandonedOnline(o: Gstr1Order): boolean {
  if (o.paymentMethod !== "RAZORPAY") return false;
  return o.status === "PENDING_PAYMENT" || (o.status === "CANCELLED" && (o.paymentStatus === "PENDING" || o.paymentStatus === "FAILED"));
}

function salesSummary(orders: Gstr1Order[], month: ReportMonth, refunds: RefundRow[]): SalesSummary {
  const placed = orders.filter((o) => inMonth(o.placedAt, month));
  const counted = placed.filter((o) => !isAbandonedOnline(o));
  const live = counted.filter((o) => o.status !== "CANCELLED");
  const sum = (list: Gstr1Order[], f: (o: Gstr1Order) => number) => list.reduce((s, o) => s + f(o), 0);
  const cod = live.filter((o) => o.paymentMethod === "COD");
  const online = live.filter((o) => o.paymentMethod !== "COD");
  return {
    orders: counted.length,
    cancelled: counted.length - live.length,
    unpaidOnline: placed.length - counted.length,
    netOrders: live.length,
    itemsValue: sum(live, (o) => o.subtotal),
    discounts: sum(live, (o) => o.couponDiscount),
    shipping: sum(live, (o) => o.shippingFee),
    codFees: sum(live, (o) => o.codFee),
    revenue: sum(live, (o) => o.total),
    cod: { orders: cod.length, amount: sum(cod, (o) => o.total) },
    online: { orders: online.length, amount: sum(online, (o) => o.total) },
    refunds: { count: refunds.length, amount: refunds.reduce((s, r) => s + r.amount, 0) },
  };
}

// ── CSV files ────────────────────────────────────────────────────────────────

const money = paiseToDecimal;
const rate = rateToDecimal;

export const GSTR1_HEADERS = {
  b2b: ["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount"],
  b2cl: ["Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"],
  b2cs: ["Type", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"],
  hsn: ["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"],
  docs: ["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"],
  register: ["Invoice No", "Invoice Date", "Customer", "Buyer GSTIN", "Place Of Supply", "State Code", "Supply Type", "GSTR-1 Table", "Rate", "Taxable Value", "IGST", "CGST", "SGST", "Total", "Invoice Value", "Payment Method", "Order No", "Status"],
  refunds: ["Order No", "Invoice No", "Invoice Date", "Event", "Event Date", "Payment Method", "Refund Status", "Refund Amount", "Place Of Supply", "Taxable Value", "IGST", "CGST", "SGST", "Note"],
  summary: ["Item", "Value"],
} as const;

const TABLE_LABEL: Record<Section, string> = { B2B: "4A (B2B)", B2CL: "5 (B2CL)", B2CS: "7 (B2CS)" };
const STATUS_TEXT: Partial<Record<OrderStatus, string>> = { CANCELLED: "Cancelled", RETURNED: "Returned", RETURN_REQUESTED: "Return requested" };
const REFUND_TEXT: Record<PaymentStatus, string> = { PENDING: "Pending", PAID: "Paid", FAILED: "Failed", REFUND_PENDING: "Refund pending", REFUNDED: "Refunded" };

function hsnRows(rows: HsnRow[]) {
  return rows.map((h) => [h.hsn, "", h.uqc, h.quantity, money(h.totalValue), rate(h.rateBps), money(h.taxable), money(h.igst), money(h.cgst), money(h.sgst), ""]);
}

export interface ExportFile {
  name: string;
  content: string;
}

export function gstr1Files(r: Gstr1Report, store: StoreInfo): ExportFile[] {
  const s = r.sales;
  const files: ExportFile[] = [
    {
      name: "register.csv",
      content: toCsv(
        GSTR1_HEADERS.register,
        r.register.map((x) => [
          x.invoiceNumber, formatGstDate(x.invoiceDate), x.customerName, x.buyerGstin ?? "", x.placeOfSupply, x.stateCode ?? "", x.supplyType,
          x.cancelled ? "13 only (cancelled)" : TABLE_LABEL[x.section], rate(x.rateBps), money(x.taxable), money(x.igst), money(x.cgst), money(x.sgst),
          money(x.total), money(x.invoiceValue), x.paymentMethod === "COD" ? "Cash on Delivery" : "Online", x.orderNumber, STATUS_TEXT[x.status] ?? "Active",
        ]),
      ),
    },
    {
      name: "b2b.csv",
      content: toCsv(
        GSTR1_HEADERS.b2b,
        r.b2b.map((x) => [x.gstin, x.receiverName, x.invoiceNumber, formatGstDate(x.invoiceDate), money(x.invoiceValue), x.placeOfSupply, "N", "", "Regular B2B", "", rate(x.rateBps), money(x.taxable), ""]),
      ),
    },
    {
      name: "b2cl.csv",
      content: toCsv(
        GSTR1_HEADERS.b2cl,
        r.b2cl.map((x) => [x.invoiceNumber, formatGstDate(x.invoiceDate), money(x.invoiceValue), x.placeOfSupply, "", rate(x.rateBps), money(x.taxable), "", ""]),
      ),
    },
    {
      name: "b2cs.csv",
      content: toCsv(GSTR1_HEADERS.b2cs, r.b2cs.map((x) => ["OE", x.placeOfSupply, "", rate(x.rateBps), money(x.taxable), "", ""])),
    },
    { name: "hsn_b2b.csv", content: toCsv(GSTR1_HEADERS.hsn, hsnRows(r.hsnB2b)) },
    { name: "hsn_b2c.csv", content: toCsv(GSTR1_HEADERS.hsn, hsnRows(r.hsnB2c)) },
    { name: "docs.csv", content: toCsv(GSTR1_HEADERS.docs, r.docs.map((d) => [d.nature, d.from, d.to, d.totalNumber, d.cancelled])) },
    {
      name: "refunds.csv",
      content: toCsv(
        GSTR1_HEADERS.refunds,
        r.refunds.map((x) => [
          x.orderNumber, x.invoiceNumber ?? "", x.invoiceDate ? formatGstDate(x.invoiceDate) : "", x.event, formatGstDate(x.eventDate),
          x.paymentMethod === "COD" ? "Cash on Delivery" : "Online", REFUND_TEXT[x.paymentStatus], money(x.amount), x.placeOfSupply,
          money(x.taxable), money(x.igst), money(x.cgst), money(x.sgst), x.note,
        ]),
      ),
    },
    {
      name: "summary.csv",
      content: toCsv(GSTR1_HEADERS.summary, [
        ["Month", r.month.label],
        ["Store GSTIN", store.gstin || "Not set"],
        ["Invoices issued", r.totals.invoices + r.totals.cancelledInvoices],
        ["Invoices cancelled", r.totals.cancelledInvoices],
        ["Taxable value", money(r.totals.taxable)],
        ["IGST", money(r.totals.igst)],
        ["CGST", money(r.totals.cgst)],
        ["SGST", money(r.totals.sgst)],
        ["Invoice value", money(r.totals.invoiceValue)],
        ["Orders placed (excl. unpaid online)", s.orders],
        ["Orders cancelled", s.cancelled],
        ["Unpaid online orders (not counted)", s.unpaidOnline],
        ["Items value", money(s.itemsValue)],
        ["Coupon discounts", money(s.discounts)],
        ["Shipping charges", money(s.shipping)],
        ["COD charges", money(s.codFees)],
        ["Revenue", money(s.revenue)],
        ["Cash on Delivery orders", s.cod.orders],
        ["Cash on Delivery value", money(s.cod.amount)],
        ["Online orders", s.online.orders],
        ["Online value", money(s.online.amount)],
        ["Refunds and returns", s.refunds.count],
        ["Refund amount", money(s.refunds.amount)],
      ]),
    },
  ];
  return files;
}

/** Plain-text cover note placed in the ZIP. */
export function gstr1Readme(r: Gstr1Report, store: StoreInfo): string {
  const lines = [
    `GSTR-1 workings for ${r.month.label}`,
    `Store GSTIN: ${store.gstin || "not set"}`,
    "",
    "Invoices are taken by invoice date (IST). Amounts are in rupees.",
    "b2b, b2cl, b2cs, hsn_b2b, hsn_b2c and docs follow the column order of the GSTN Returns Offline Tool.",
    "B2CL holds inter-state B2C invoices above Rs 1,00,000 (Notification 12/2024-Central Tax, from August 2024).",
    "Delivery and COD charges are taxed with the main item (composite supply) and are included in its HSN row.",
    "The store does not issue credit notes yet. Returns and refunds are listed in refunds.csv for the accountant to decide.",
    "register.csv lists every invoice in the month, including cancelled ones, one row per tax rate.",
  ];
  if (r.warnings.length) lines.push("", "Check before filing:", ...r.warnings.map((w) => `- ${w}`));
  return lines.join("\r\n") + "\r\n";
}
