import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { formatINRExact } from "@/lib/money";
import { formatRate } from "@/lib/gst";
import { B2CL_THRESHOLD, currentMonth, formatGstDate, parseMonth, type HsnRow } from "@/lib/reports/gstr1";
import { loadGstr1Report } from "@/lib/reports/gstr1-data";
import { AdminPage, Panel, Stat, td, th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "GST (GSTR-1)" };

const FILES = ["register.csv", "b2b.csv", "b2cl.csv", "b2cs.csv", "hsn_b2b.csv", "hsn_b2c.csv", "docs.csv", "refunds.csv", "summary.csv"];
const cell = `${td} whitespace-nowrap`;
const num = `${cell} text-right tabular-nums`;
const numTh = `${th} text-right`;

/** Like the admin Table, but the scroll area is focusable so keyboard users can scroll wide tables. */
function ReportTable({ label, headers, rows, empty, numeric = 0 }: { label: string; headers: string[]; rows: ReactNode[][]; empty: string; numeric?: number }) {
  if (rows.length === 0) return <p className="text-sm text-ink-500">{empty}</p>;
  const isNum = (i: number) => numeric > 0 && i >= headers.length - numeric;
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto rounded-2xl border border-ink-200 bg-white focus-visible:outline-2 focus-visible:outline-brand-600">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr>{headers.map((h, i) => <th key={h} scope="col" className={isNum(i) ? numTh : th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((c, i) => <td key={i} className={isNum(i) ? num : cell}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const money = formatINRExact;

function hsnTable(label: string, rows: HsnRow[], empty: string) {
  return (
    <ReportTable
      label={label}
      headers={["HSN", "UQC", "Rate", "Quantity", "Taxable value", "IGST", "CGST", "SGST", "Total value"]}
      numeric={6}
      empty={empty}
      rows={rows.map((h) => [h.hsn, h.uqc, formatRate(h.rateBps), h.quantity, money(h.taxable), money(h.igst), money(h.cgst), money(h.sgst), money(h.totalValue)])}
    />
  );
}

export default async function GstReportPage(props: PageProps<"/admin/reports/gst">) {
  const sp = await props.searchParams;
  const month = parseMonth(sp.month);
  const { report: r } = await loadGstr1Report(month);
  const s = r.sales;
  const exportHref = (file?: string) => `/admin/reports/gst/export?month=${month.key}${file ? `&file=${file}` : ""}`;

  return (
    <AdminPage
      title="GST (GSTR-1)"
      description={`${month.label}. Invoices are counted by invoice date (IST). Nothing here changes any order.`}
      actions={
        <a href={exportHref()} download className={buttonClasses("primary", "sm")}>
          <Download className="h-4 w-4" aria-hidden="true" /> Download ZIP of CSVs
        </a>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form action="/admin/reports/gst" className="flex items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink-700">Month</span>
            <input type="month" name="month" defaultValue={month.key} min="2017-07" max={currentMonth().key} required className="h-10 rounded-xl border border-ink-300 bg-white px-3 text-sm" />
          </label>
          <button className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white">Show</button>
        </form>
        <Link href="/admin/reports" className="text-sm font-semibold text-brand-700 hover:underline">All reports</Link>
      </div>

      {r.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Check before filing</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Taxable value" value={money(r.totals.taxable)} />
        <Stat label="IGST" value={money(r.totals.igst)} />
        <Stat label="CGST" value={money(r.totals.cgst)} />
        <Stat label="SGST" value={money(r.totals.sgst)} />
        <Stat label="Invoices" value={r.totals.invoices} hint={`${r.totals.cancelledInvoices} cancelled · value ${money(r.totals.invoiceValue)}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Sales summary" className="min-w-0">
          <p className="mb-3 text-sm text-ink-500">Orders placed in {month.label}, by order date. Online orders that were never paid are left out.</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <dt>Orders placed</dt><dd className="text-right tabular-nums">{s.orders}</dd>
            <dt>Cancelled</dt><dd className="text-right tabular-nums">{s.cancelled}</dd>
            <dt>Unpaid online orders (not counted)</dt><dd className="text-right tabular-nums">{s.unpaidOnline}</dd>
            <dt>Items value</dt><dd className="text-right tabular-nums">{money(s.itemsValue)}</dd>
            <dt>Coupon discounts</dt><dd className="text-right tabular-nums">{s.discounts ? `−${money(s.discounts)}` : money(0)}</dd>
            <dt>Shipping charges</dt><dd className="text-right tabular-nums">{money(s.shipping)}</dd>
            <dt>COD charges</dt><dd className="text-right tabular-nums">{money(s.codFees)}</dd>
            <dt className="font-bold">Revenue ({s.netOrders} orders)</dt><dd className="text-right font-bold tabular-nums">{money(s.revenue)}</dd>
            <dt>Cash on Delivery</dt><dd className="text-right tabular-nums">{s.cod.orders} · {money(s.cod.amount)}</dd>
            <dt>Online</dt><dd className="text-right tabular-nums">{s.online.orders} · {money(s.online.amount)}</dd>
            <dt>Refunds and returns in the month</dt><dd className="text-right tabular-nums">{s.refunds.count} · {money(s.refunds.amount)}</dd>
          </dl>
        </Panel>
        <Panel title="Downloads" className="min-w-0">
          <p className="text-sm text-ink-500">
            UTF-8 CSV files that open in Excel. The b2b, b2cl, b2cs, hsn and docs files use the column order of the GSTN Returns Offline Tool. Amounts are in rupees.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {FILES.map((f) => (
              <li key={f}><a href={exportHref(f)} download className={buttonClasses("outline", "sm")}>{f}</a></li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-500">
            The store doesn&apos;t issue credit notes yet, so returns and refunds are listed in refunds.csv for the accountant to decide on.
          </p>
        </Panel>
      </div>

      <Panel title="B2C small (Table 7)">
        <ReportTable
          label="B2C small (Table 7)"
          headers={["Place of supply", "Rate", "Invoices", "Taxable value", "IGST", "CGST", "SGST"]}
          numeric={5}
          empty="No B2C small supplies this month."
          rows={r.b2cs.map((x) => [x.placeOfSupply, formatRate(x.rateBps), x.invoices, money(x.taxable), money(x.igst), money(x.cgst), money(x.sgst)])}
        />
      </Panel>

      <Panel title="B2C large (Table 5)">
        <p className="mb-3 text-sm text-ink-500">Inter-state invoices to unregistered buyers above {money(B2CL_THRESHOLD)}.</p>
        <ReportTable
          label="B2C large (Table 5)"
          headers={["Invoice", "Date", "Place of supply", "Rate", "Invoice value", "Taxable value", "IGST"]}
          numeric={3}
          empty="No B2C large invoices this month."
          rows={r.b2cl.map((x) => [x.invoiceNumber, formatGstDate(x.invoiceDate), x.placeOfSupply, formatRate(x.rateBps), money(x.invoiceValue), money(x.taxable), money(x.igst)])}
        />
      </Panel>

      <Panel title="B2B (Table 4A)">
        <p className="mb-3 text-sm text-ink-500">Invoices where the buyer gave a GSTIN at checkout.</p>
        <ReportTable
          label="B2B (Table 4A)"
          headers={["GSTIN", "Buyer", "Invoice", "Date", "Place of supply", "Rate", "Taxable value", "IGST", "CGST", "SGST"]}
          numeric={4}
          empty="No B2B invoices this month."
          rows={r.b2b.map((x) => [x.gstin, x.receiverName, x.invoiceNumber, formatGstDate(x.invoiceDate), x.placeOfSupply, formatRate(x.rateBps), money(x.taxable), money(x.igst), money(x.cgst), money(x.sgst)])}
        />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="HSN summary, B2B (Table 12)" className="min-w-0">{hsnTable("HSN summary, B2B", r.hsnB2b, "No B2B supplies this month.")}</Panel>
        <Panel title="HSN summary, B2C (Table 12)" className="min-w-0">{hsnTable("HSN summary, B2C", r.hsnB2c, "No B2C supplies this month.")}</Panel>
      </div>

      <Panel title="Documents issued (Table 13)">
        <ReportTable
          label="Documents issued (Table 13)"
          headers={["Nature of document", "From", "To", "Total", "Cancelled"]}
          numeric={2}
          empty="No invoices were issued this month."
          rows={r.docs.map((d) => [d.nature, d.from, d.to, d.totalNumber, d.cancelled])}
        />
      </Panel>

      <Panel title="Returns and refunds">
        <p className="mb-3 text-sm text-ink-500">Orders returned, or cancelled after payment, in {month.label}. No credit notes are issued for these yet.</p>
        <ReportTable
          label="Returns and refunds"
          headers={["Order", "Invoice", "Event", "Date", "Refund status", "Amount"]}
          numeric={1}
          empty="No returns or refunds this month."
          rows={r.refunds.map((x) => [x.orderNumber, x.invoiceNumber ?? "—", x.event, formatGstDate(x.eventDate), x.paymentStatus === "REFUNDED" ? "Refunded" : x.paymentStatus === "REFUND_PENDING" ? "Refund pending" : "—", money(x.amount)])}
        />
      </Panel>

      <Panel title="Invoice register">
        <ReportTable
          label="Invoice register"
          headers={["Invoice", "Date", "Customer", "Order", "Place of supply", "Type", "Rate", "Taxable value", "IGST", "CGST", "SGST", "Total"]}
          numeric={5}
          empty="No invoices were issued this month."
          rows={r.register.map((x) => [
            <span key="n" className="font-semibold">{x.invoiceNumber}</span>,
            formatGstDate(x.invoiceDate),
            x.customerName,
            x.orderNumber,
            `${x.placeOfSupply} (${x.stateCode ?? "—"})`,
            x.cancelled ? <Badge key="b" tone="danger">Cancelled</Badge> : x.section,
            formatRate(x.rateBps),
            money(x.taxable),
            money(x.igst),
            money(x.cgst),
            money(x.sgst),
            money(x.total),
          ])}
        />
      </Panel>
    </AdminPage>
  );
}
