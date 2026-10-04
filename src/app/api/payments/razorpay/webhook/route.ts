import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { markOrderPaid, recordPaymentFailure } from "@/lib/orders/service";

/**
 * Razorpay webhook (Dashboard → Settings → Webhooks). Subscribe to:
 *   payment.captured, payment.failed, order.paid, refund.processed, refund.failed
 * Handles payments even if the shopper closed the browser before the
 * Checkout callback reached us. All handlers are idempotent.
 */
export async function POST(req: NextRequest) {
  const secret = env().RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!signature || !verifyWebhookSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event: string; payload: Record<string, { entity: Record<string, unknown> }> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const payment = event.payload.payment?.entity as { id: string; order_id: string; amount: number; method?: string; error_description?: string } | undefined;
    switch (event.event) {
      case "payment.captured":
      case "order.paid":
        if (payment?.order_id) {
          await markOrderPaid({ providerOrderId: payment.order_id, providerPaymentId: payment.id, method: payment.method, amount: payment.amount });
        }
        break;
      case "payment.failed":
        if (payment?.order_id) await recordPaymentFailure(payment.order_id, payment.error_description ?? "Payment failed");
        break;
      case "refund.processed":
      case "refund.failed": {
        const refund = event.payload.refund?.entity as { id: string; payment_id: string } | undefined;
        if (refund) {
          const p = await db.payment.findFirst({ where: { providerPaymentId: refund.payment_id } });
          if (p) {
            const status = event.event === "refund.processed" ? "REFUNDED" : "REFUND_PENDING";
            await db.payment.update({ where: { id: p.id }, data: { status, refundId: refund.id } });
            await db.order.update({
              where: { id: p.orderId },
              data: {
                paymentStatus: status,
                events: { create: { message: event.event === "refund.processed" ? "Refund processed to your original payment method." : "Refund failed at the bank — our team will retry.", isPublic: event.event === "refund.processed" } },
              },
            });
          }
        }
        break;
      }
      default:
        break; // acknowledge events we don't use
    }
  } catch (err) {
    console.error(`[webhook] ${event.event} failed`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // Razorpay retries
  }
  return NextResponse.json({ ok: true });
}
