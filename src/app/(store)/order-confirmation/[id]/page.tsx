import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getOrderForUser } from "@/lib/orders/queries";
import { formatDeliveryDate } from "@/lib/delivery";
import { formatINR } from "@/lib/money";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage(props: PageProps<"/order-confirmation/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/order-confirmation/${id}`);
  const order = await getOrderForUser(id, user.id);
  if (!order) notFound();
  const confirmed = order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED";
  return (
    <div className="container-page flex justify-center py-12">
      <div className="card w-full max-w-xl p-6 text-center sm:p-10">
        <CheckCircle2 className={`mx-auto h-14 w-14 ${confirmed ? "text-mint-600" : "text-amber-500"}`} aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-extrabold">{confirmed ? "Thank you! Your order is confirmed." : "Your order is awaiting payment"}</h1>
        <p className="mt-2 text-ink-500">Order <strong className="text-ink-900">{order.orderNumber}</strong> · {formatINR(order.total)} · {order.paymentMethod === "COD" ? "Cash on Delivery" : order.paymentStatus === "PAID" ? "Paid online" : "Online payment pending"}</p>
        {confirmed && order.estimatedDeliveryTo && (
          <p className="mt-4 rounded-xl bg-mint-50 px-4 py-3 font-semibold text-mint-700">Expected delivery by {formatDeliveryDate(order.estimatedDeliveryTo)}</p>
        )}
        <p className="mt-4 text-sm text-ink-500">We&apos;ve emailed the details to {order.email}. You can track this order from your account.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href={`/account/orders/${order.id}`}>View order</ButtonLink>
          <ButtonLink href="/" variant="outline">Continue shopping</ButtonLink>
        </div>
      </div>
    </div>
  );
}
