import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getOrderForUser } from "@/lib/orders/queries";
import { CUSTOMER_CANCELLABLE, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, returnWindowOpen, statusTone } from "@/lib/orders/status";
import { formatDeliveryDate } from "@/lib/delivery";
import { formatINR } from "@/lib/money";
import { razorpayConfigured } from "@/lib/env";
import { Badge, Breadcrumbs } from "@/components/ui/misc";
import { OrderTracker } from "@/components/account/order-tracker";
import { CancelOrderForm, CompletePaymentButton, ReturnRequestForm } from "@/components/account/order-actions";
import { ProductImage } from "@/components/product/product-image";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderDetailPage(props: PageProps<"/account/orders/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/account/orders/${id}`);
  const order = await getOrderForUser(id, user.id);
  if (!order) notFound();
  const sp = await props.searchParams;
  const returnDays = Math.max(0, ...order.items.map((i) => i.product?.returnWindowDays ?? 0));
  const canReturn = order.status === "DELIVERED" && returnWindowOpen(order.deliveredAt, returnDays);
  const awaitingPayment = order.status === "PENDING_PAYMENT";
  const payDeadline = order.paymentExpiresAt;

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ name: "Account", href: "/account" }, { name: "Orders", href: "/account/orders" }, { name: order.orderNumber }]} />
      {sp.payment === "incomplete" && awaitingPayment && (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Payment wasn&apos;t completed. Your items are reserved until {payDeadline?.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} — complete payment below to confirm the order.</p>
      )}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold">Order {order.orderNumber}</h1>
            <p className="text-sm text-ink-500">Placed on {order.placedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge>
            <Badge tone={order.paymentStatus === "PAID" ? "success" : order.paymentStatus === "FAILED" ? "danger" : "neutral"}>
              {order.paymentMethod === "COD" ? "COD" : "Online"} · {PAYMENT_STATUS_LABEL[order.paymentStatus]}
            </Badge>
          </div>
        </div>
        {order.status !== "CANCELLED" && order.status !== "DELIVERED" && order.estimatedDeliveryTo && !awaitingPayment && (
          <p className="mt-3 text-sm font-semibold text-mint-700">Expected delivery by {formatDeliveryDate(order.estimatedDeliveryTo)}</p>
        )}
        {order.trackingNumber && (
          <p className="mt-2 text-sm">Shipped with <strong>{order.courierName}</strong> · Tracking no. <strong>{order.trackingNumber}</strong>{order.trackingUrl && <> · <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">Track shipment</a></>}</p>
        )}
        <div className="mt-6"><OrderTracker status={order.status} events={order.events} /></div>
        {order.status === "CANCELLED" && <p className="mt-4 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">This order was cancelled{order.cancelReason ? `: ${order.cancelReason}` : "."}{order.paymentStatus === "REFUND_PENDING" ? " Your refund has been initiated." : order.paymentStatus === "REFUNDED" ? " Your refund has been processed." : ""}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          {awaitingPayment && razorpayConfigured() && <CompletePaymentButton orderId={order.id} label={`Complete payment · ${formatINR(order.total)}`} />}
          {CUSTOMER_CANCELLABLE.includes(order.status) && <CancelOrderForm orderId={order.id} />}
          {canReturn && <ReturnRequestForm orderId={order.id} />}
          {order.invoiceNumber && <Link href={`/invoice/${order.id}`} target="_blank" className="inline-flex h-11 items-center rounded-xl border border-ink-300 px-5 font-semibold hover:bg-ink-50">Download tax invoice</Link>}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="card p-5" aria-labelledby="items">
          <h2 id="items" className="font-bold">Items</h2>
          <ul className="mt-3 divide-y divide-ink-100">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-3 py-3">
                <div className="w-16 shrink-0"><ProductImage image={i.imageUrl ? { url: i.imageUrl, alt: "" } : null} name={i.productName} sizes="64px" /></div>
                <div className="min-w-0 flex-1 text-sm">
                  {i.product ? <Link href={`/p/${i.product.slug}`} className="font-semibold hover:text-brand-700">{i.productName}</Link> : <span className="font-semibold">{i.productName}</span>}
                  {i.variantLabel && <p className="text-ink-500">{i.variantLabel}</p>}
                  <p className="text-ink-500">Qty {i.quantity} × {formatINR(i.unitPrice)}</p>
                  {order.status === "DELIVERED" && i.product && <Link href={`/p/${i.product.slug}/review`} className="mt-1 inline-block font-semibold text-brand-700 hover:underline">Rate & review</Link>}
                </div>
                <p className="text-sm font-semibold">{formatINR(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          {order.events.length > 0 && (
            <>
              <h2 className="mt-6 font-bold">Updates</h2>
              <ol className="mt-3 space-y-3 border-l-2 border-ink-100 pl-4">
                {[...order.events].reverse().map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-ink-900">{e.message}</p>
                    <p className="text-xs text-ink-500">{e.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
        <aside className="space-y-4">
          <section className="card p-5 text-sm">
            <h2 className="font-bold">Delivery address</h2>
            <p className="mt-2 font-semibold">{order.shipName}</p>
            <p className="text-ink-700">{[order.shipLine1, order.shipLine2, order.shipLandmark, order.shipCity, `${order.shipState} ${order.shipPincode}`].filter(Boolean).join(", ")}</p>
            <p className="text-ink-500">Mobile: {order.shipPhone}</p>
            {order.buyerGstin && <p className="mt-2 text-ink-700">GSTIN: {order.buyerGstin} ({order.buyerCompany})</p>}
          </section>
          <section className="card p-5 text-sm">
            <h2 className="font-bold">Payment summary</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between"><dt>Items</dt><dd>{formatINR(order.subtotal)}</dd></div>
              {order.couponDiscount > 0 && <div className="flex justify-between text-mint-700"><dt>Coupon ({order.couponCode})</dt><dd>− {formatINR(order.couponDiscount)}</dd></div>}
              <div className="flex justify-between"><dt>Delivery</dt><dd>{order.shippingFee ? formatINR(order.shippingFee) : "Free"}</dd></div>
              {order.codFee > 0 && <div className="flex justify-between"><dt>COD fee</dt><dd>{formatINR(order.codFee)}</dd></div>}
              <div className="flex justify-between border-t border-ink-100 pt-2 font-bold"><dt>Total</dt><dd>{formatINR(order.total)}</dd></div>
              <div className="flex justify-between text-xs text-ink-500"><dt>Includes GST</dt><dd>{formatINR(order.cgst + order.sgst + order.igst)}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
