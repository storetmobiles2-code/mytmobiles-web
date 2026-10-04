import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatINR, formatINRExact } from "@/lib/money";
import { ADMIN_CANCELLABLE, NEXT_STATUSES, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, statusTone } from "@/lib/orders/status";
import { AdminPage, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";
import { AdminCancelForm, AdvanceStatusForm, MarkRefundedForm, OrderNoteForm } from "@/components/admin/order-admin-forms";

export const metadata = { title: "Order" };

export default async function AdminOrderDetail(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, payments: { orderBy: { createdAt: "desc" } }, events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } }, user: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!order) notFound();
  const next = NEXT_STATUSES[order.status] ?? [];
  return (
    <AdminPage
      title={`Order ${order.orderNumber}`}
      description={`Placed ${order.placedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
      actions={
        <>
          <Badge tone={statusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge>
          <Badge tone={order.paymentStatus === "PAID" ? "success" : "neutral"}>{order.paymentMethod} · {PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
          {order.invoiceNumber && <Link href={`/invoice/${order.id}`} target="_blank" className="rounded-lg border border-ink-300 bg-white px-3 py-1 text-sm font-semibold">Invoice {order.invoiceNumber}</Link>}
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Panel title="Items">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-ink-500 uppercase"><th className="py-1">Item</th><th>SKU</th><th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">Line</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} className="border-t border-ink-100">
                    <td className="py-2">{i.productName}{i.variantLabel && <span className="block text-xs text-ink-500">{i.variantLabel}</span>}</td>
                    <td className="font-mono text-xs">{i.sku}</td>
                    <td className="text-right">{i.quantity}</td>
                    <td className="text-right">{formatINR(i.unitPrice)}</td>
                    <td className="text-right font-semibold">{formatINR(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 grid grid-cols-2 gap-y-1 border-t border-ink-100 pt-3 text-sm sm:max-w-sm sm:justify-self-end">
              <dt>Subtotal</dt><dd className="text-right">{formatINR(order.subtotal)}</dd>
              {order.couponDiscount > 0 && <><dt>Coupon {order.couponCode}</dt><dd className="text-right text-mint-700">−{formatINR(order.couponDiscount)}</dd></>}
              <dt>Delivery</dt><dd className="text-right">{formatINR(order.shippingFee)}</dd>
              {order.codFee > 0 && <><dt>COD fee</dt><dd className="text-right">{formatINR(order.codFee)}</dd></>}
              <dt className="font-bold">Total</dt><dd className="text-right font-bold">{formatINR(order.total)}</dd>
              <dt className="text-ink-500">Taxable value</dt><dd className="text-right text-ink-500">{formatINRExact(order.taxableValue)}</dd>
              <dt className="text-ink-500">{order.isInterState ? "IGST" : "CGST + SGST"}</dt><dd className="text-right text-ink-500">{formatINRExact(order.igst + order.cgst + order.sgst)}</dd>
            </dl>
          </Panel>
          <Panel title="Timeline">
            <ol className="space-y-3 text-sm">
              {order.events.map((e) => (
                <li key={e.id} className="border-l-2 border-ink-200 pl-3">
                  <p>{e.message} {!e.isPublic && <Badge>internal</Badge>}</p>
                  <p className="text-xs text-ink-500">{e.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{e.actor ? ` · ${e.actor.name}` : ""}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 border-t border-ink-100 pt-4"><OrderNoteForm orderId={order.id} /></div>
          </Panel>
        </div>
        <div className="space-y-4">
          {(next.length > 0 || ADMIN_CANCELLABLE.includes(order.status) || order.paymentStatus === "REFUND_PENDING") && (
            <Panel title="Actions">
              <div className="space-y-4">
                <AdvanceStatusForm orderId={order.id} next={next} />
                {order.paymentStatus === "REFUND_PENDING" && <MarkRefundedForm orderId={order.id} />}
                {ADMIN_CANCELLABLE.includes(order.status) && <details className="rounded-xl border border-danger-600/20 p-3"><summary className="cursor-pointer text-sm font-semibold text-danger-700">Cancel this order</summary><div className="mt-3"><AdminCancelForm orderId={order.id} /></div></details>}
              </div>
            </Panel>
          )}
          <Panel title="Customer">
            <p className="text-sm font-semibold"><Link href={`/admin/customers/${order.user.id}`} className="text-brand-700 hover:underline">{order.user.name}</Link></p>
            <p className="text-sm text-ink-500">{order.user.email}{order.user.phone ? ` · ${order.user.phone}` : ""}</p>
            <h3 className="mt-4 text-xs font-bold text-ink-500 uppercase">Ship to</h3>
            <p className="text-sm">{order.shipName} · {order.shipPhone}<br />{[order.shipLine1, order.shipLine2, order.shipLandmark, order.shipCity, `${order.shipState} ${order.shipPincode}`].filter(Boolean).join(", ")}</p>
            {order.buyerGstin && <p className="mt-2 text-sm">GSTIN {order.buyerGstin} · {order.buyerCompany}</p>}
            {order.estimatedDeliveryTo && <p className="mt-2 text-sm text-ink-500">Promised by {order.estimatedDeliveryTo.toLocaleDateString("en-IN")}</p>}
            {order.trackingNumber && <p className="mt-2 text-sm">{order.courierName} · {order.trackingNumber}</p>}
            {order.cancelReason && <p className="mt-2 text-sm text-danger-700">Cancelled: {order.cancelReason}</p>}
            {order.returnReason && <p className="mt-2 text-sm text-amber-800">Return reason: {order.returnReason}</p>}
          </Panel>
          <Panel title="Payments">
            <ul className="space-y-2 text-sm">
              {order.payments.map((p) => (
                <li key={p.id} className="rounded-lg bg-ink-50 p-2.5">
                  <p className="font-semibold">{p.provider} · {formatINR(p.amount)} · {PAYMENT_STATUS_LABEL[p.status]}</p>
                  {p.providerPaymentId && <p className="font-mono text-xs">{p.providerPaymentId}</p>}
                  {p.providerOrderId && <p className="font-mono text-xs text-ink-500">{p.providerOrderId}</p>}
                  {p.failureReason && <p className="text-xs text-danger-700">{p.failureReason}</p>}
                  {p.refundId && <p className="text-xs">Refund {p.refundId}</p>}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
