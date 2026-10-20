import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { formatINR } from "@/lib/money";
import { PrintButton } from "@/app/invoice/[orderId]/print-button";

export const metadata: Metadata = { title: "Packing slip", robots: { index: false } };
export const dynamic = "force-dynamic";

/** What goes in the box: items and quantities, no prices. For the packing desk. */
export default async function PackingSlipPage(props: PageProps<"/packing-slip/[orderId]">) {
  await requirePermission("orders.print");
  const { orderId } = await props.params;
  const [order, s] = await Promise.all([db.order.findUnique({ where: { id: orderId }, include: { items: true } }), getSettings()]);
  if (!order) notFound();
  const units = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <main className="mx-auto max-w-3xl bg-white p-6 text-[14px] text-ink-900 sm:p-10 print:p-0">
      <div className="no-print mb-6 flex justify-end"><PrintButton /></div>
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink-900 pb-4">
        <div>
          <h1 className="text-xl font-extrabold">PACKING SLIP</h1>
          <p className="mt-1 font-bold">{s.storeName}</p>
          <p className="max-w-xs text-ink-700">{[s.addressLine1, s.addressLine2, s.city, `${s.state} ${s.pincode}`].filter((x) => x && x.trim()).join(", ")}</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right">
          <dt className="text-ink-500">Order no.</dt><dd className="font-bold">{order.orderNumber}</dd>
          <dt className="text-ink-500">Order date</dt><dd>{order.placedAt.toLocaleDateString("en-IN")}</dd>
          {order.invoiceNumber && <><dt className="text-ink-500">Invoice no.</dt><dd>{order.invoiceNumber}</dd></>}
          {order.trackingNumber && <><dt className="text-ink-500">AWB</dt><dd>{order.courierName} {order.trackingNumber}</dd></>}
        </dl>
      </header>
      <section className="border-b border-ink-200 py-4">
        <h2 className="text-xs font-bold tracking-wide text-ink-500 uppercase">Ship to</h2>
        <p className="mt-1 text-base font-semibold">{order.shipName}</p>
        <p>{[order.shipLine1, order.shipLine2, order.shipLandmark, order.shipCity, `${order.shipState} ${order.shipPincode}`].filter(Boolean).join(", ")}</p>
        <p>Phone: {order.shipPhone}</p>
        <p className="mt-2 font-semibold">{order.paymentMethod === "COD" ? `Cash on Delivery: collect ${formatINR(order.total)}` : "Prepaid: nothing to collect"}</p>
      </section>
      <table className="mt-4 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-ink-900 text-xs uppercase">
            <th className="py-2 pr-2">#</th><th className="py-2 pr-2">Item</th><th className="py-2 pr-2">SKU</th><th className="py-2 pr-2 text-right">Qty</th><th className="py-2 text-center">Packed</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i, n) => (
            <tr key={i.id} className="border-b border-ink-200 align-top">
              <td className="py-2 pr-2">{n + 1}</td>
              <td className="py-2 pr-2">{i.productName}{i.variantLabel && <span className="block text-xs text-ink-500">{i.variantLabel}</span>}</td>
              <td className="py-2 pr-2 font-mono text-xs">{i.sku}</td>
              <td className="py-2 pr-2 text-right text-base font-bold">{i.quantity}</td>
              <td className="py-2 text-center"><span className="inline-block h-4 w-4 border border-ink-500" aria-hidden="true" /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold"><td colSpan={3} className="py-2 pr-2 text-right">Total units</td><td className="py-2 pr-2 text-right">{units}</td><td /></tr>
        </tfoot>
      </table>
      <p className="mt-6 text-xs text-ink-500">Check each IMEI/serial number against the box before sealing. Put the tax invoice in the box.</p>
      <footer className="mt-10 grid grid-cols-2 gap-6 text-xs text-ink-500">
        <p className="border-t border-ink-400 pt-1">Packed by</p>
        <p className="border-t border-ink-400 pt-1">Checked by</p>
      </footer>
    </main>
  );
}
