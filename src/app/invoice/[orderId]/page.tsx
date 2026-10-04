import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { computeInvoiceTax } from "@/lib/pricing";
import { formatINRExact } from "@/lib/money";
import { formatRate } from "@/lib/gst";
import { stateCode } from "@/lib/indian-states";
import { amountInWords } from "@/lib/number-words";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Tax invoice", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvoicePage(props: PageProps<"/invoice/[orderId]">) {
  const { orderId } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/invoice/${orderId}`);
  const order = await db.order.findFirst({ where: { id: orderId, ...(user.role === "ADMIN" ? {} : { userId: user.id }) }, include: { items: true } });
  if (!order) notFound();
  const s = await getSettings();

  if (!order.invoiceNumber) {
    return <main className="mx-auto max-w-xl p-10 text-center"><h1 className="text-xl font-bold">Invoice not generated yet</h1><p className="mt-2 text-ink-500">The tax invoice is issued when your order is dispatched.</p></main>;
  }

  const fees = order.shippingFee + order.codFee;
  const principalRate = Math.max(...order.items.map((i) => i.gstRateBps));
  const principalHsn = order.items.find((i) => i.gstRateBps === principalRate)?.hsnCode ?? "";
  const feeTax = computeInvoiceTax([{ amountInclusive: fees, gstRateBps: principalRate }], order.isInterState).lines[0];
  const rows = [
    ...order.items.map((i) => ({ desc: `${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ""}`, sku: i.sku, hsn: i.hsnCode, qty: i.quantity, rate: i.gstRateBps, gross: i.lineTotal, discount: i.discount, taxable: i.taxableValue, tax: i.taxAmount })),
    ...(fees > 0 ? [{ desc: `Delivery${order.codFee ? " & COD" : ""} charges`, sku: "", hsn: principalHsn, qty: 1, rate: principalRate, gross: fees, discount: 0, taxable: feeTax.taxableValue, tax: feeTax.taxAmount }] : []),
  ];
  const half = (t: number) => Math.floor(t / 2);
  const supplierState = s.state || "—";
  const placeOfSupply = `${order.shipState} (${stateCode(order.shipState) ?? "—"})`;

  return (
    <main className="mx-auto max-w-4xl bg-white p-6 text-[13px] text-ink-900 sm:p-10 print:p-0">
      <div className="no-print mb-6 flex justify-end"><PrintButton /></div>
      {(!s.gstin || !s.legalName) && (
        <p className="no-print mb-4 rounded-lg bg-danger-50 px-3 py-2 text-danger-700">Store GSTIN / legal name are not configured (Admin → Settings). This document is not a valid tax invoice until they are.</p>
      )}
      <header className="flex items-start justify-between border-b-2 border-ink-900 pb-4">
        <div>
          <h1 className="text-xl font-extrabold">TAX INVOICE</h1>
          <p className="mt-1 font-bold">{s.legalName || s.storeName}</p>
          <p className="max-w-xs text-ink-700">{[s.addressLine1, s.addressLine2, s.city, `${s.state} ${s.pincode}`].filter((x) => x && x.trim()).join(", ")}</p>
          <p>GSTIN: <strong>{s.gstin || "—"}</strong> · State: {supplierState} ({stateCode(s.state) ?? "—"})</p>
          {(s.supportEmail || s.supportPhone) && <p className="text-ink-700">{[s.supportPhone, s.supportEmail].filter(Boolean).join(" · ")}</p>}
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right">
          <dt className="text-ink-500">Invoice no.</dt><dd className="font-bold">{order.invoiceNumber}</dd>
          <dt className="text-ink-500">Invoice date</dt><dd>{order.invoicedAt?.toLocaleDateString("en-IN")}</dd>
          <dt className="text-ink-500">Order no.</dt><dd>{order.orderNumber}</dd>
          <dt className="text-ink-500">Order date</dt><dd>{order.placedAt.toLocaleDateString("en-IN")}</dd>
          <dt className="text-ink-500">Payment</dt><dd>{order.paymentMethod === "COD" ? "Cash on Delivery" : "Prepaid (online)"}</dd>
        </dl>
      </header>
      <section className="grid gap-6 border-b border-ink-200 py-4 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-bold tracking-wide text-ink-500 uppercase">Bill to / Ship to</h2>
          <p className="mt-1 font-semibold">{order.buyerCompany ?? order.shipName}</p>
          {order.buyerCompany && <p>{order.shipName}</p>}
          <p className="text-ink-700">{[order.shipLine1, order.shipLine2, order.shipLandmark, order.shipCity, `${order.shipState} ${order.shipPincode}`].filter(Boolean).join(", ")}</p>
          <p>Phone: {order.shipPhone}</p>
          {order.buyerGstin && <p>GSTIN: <strong>{order.buyerGstin}</strong></p>}
        </div>
        <div className="sm:text-right">
          <p>Place of supply: <strong>{placeOfSupply}</strong></p>
          <p>Tax type: {order.isInterState ? "IGST (inter-state)" : "CGST + SGST (intra-state)"}</p>
          <p>Reverse charge: No</p>
        </div>
      </section>
      <div className="overflow-x-auto">
        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-ink-900 text-xs uppercase">
              <th className="py-2 pr-2">#</th><th className="py-2 pr-2">Description</th><th className="py-2 pr-2">HSN</th><th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Gross</th><th className="py-2 pr-2 text-right">Discount</th><th className="py-2 pr-2 text-right">Taxable value</th>
              {order.isInterState ? <th className="py-2 pr-2 text-right">IGST</th> : <><th className="py-2 pr-2 text-right">CGST</th><th className="py-2 pr-2 text-right">SGST</th></>}
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-ink-200 align-top">
                <td className="py-2 pr-2">{i + 1}</td>
                <td className="py-2 pr-2">{r.desc}{r.sku && <span className="block text-xs text-ink-500">SKU {r.sku}</span>}</td>
                <td className="py-2 pr-2">{r.hsn}</td>
                <td className="py-2 pr-2 text-right">{r.qty}</td>
                <td className="py-2 pr-2 text-right">{formatINRExact(r.gross)}</td>
                <td className="py-2 pr-2 text-right">{r.discount ? `−${formatINRExact(r.discount)}` : "—"}</td>
                <td className="py-2 pr-2 text-right">{formatINRExact(r.taxable)}</td>
                {order.isInterState ? (
                  <td className="py-2 pr-2 text-right">{formatINRExact(r.tax)}<span className="block text-xs text-ink-500">@{formatRate(r.rate)}</span></td>
                ) : (
                  <>
                    <td className="py-2 pr-2 text-right">{formatINRExact(half(r.tax))}<span className="block text-xs text-ink-500">@{formatRate(r.rate / 2)}</span></td>
                    <td className="py-2 pr-2 text-right">{formatINRExact(r.tax - half(r.tax))}<span className="block text-xs text-ink-500">@{formatRate(r.rate / 2)}</span></td>
                  </>
                )}
                <td className="py-2 text-right font-semibold">{formatINRExact(r.taxable + r.tax)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td colSpan={6} className="py-2 pr-2 text-right">Totals</td>
              <td className="py-2 pr-2 text-right">{formatINRExact(order.taxableValue)}</td>
              {order.isInterState ? <td className="py-2 pr-2 text-right">{formatINRExact(order.igst)}</td> : <><td className="py-2 pr-2 text-right">{formatINRExact(order.cgst)}</td><td className="py-2 pr-2 text-right">{formatINRExact(order.sgst)}</td></>}
              <td className="py-2 text-right">{formatINRExact(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-4"><strong>Amount in words:</strong> {amountInWords(order.total)}</p>
      <footer className="mt-10 flex items-end justify-between gap-6 border-t border-ink-200 pt-4 text-xs text-ink-500">
        <p className="max-w-md">Goods once sold are subject to the returns policy at the time of purchase. This is a computer-generated invoice. Subject to {s.city || "local"} jurisdiction.</p>
        <div className="text-center"><div className="h-12" /><p className="border-t border-ink-400 pt-1">Authorised signatory<br />for {s.legalName || s.storeName}</p></div>
      </footer>
    </main>
  );
}
