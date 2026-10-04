"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { cancelOrder, OrderError, placeOrder, requestReturn, startOnlinePayment, verifyAndConfirmPayment, recordPaymentFailure } from "@/lib/orders/service";
import { env } from "@/lib/env";
import { gstinSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { trackServer } from "@/lib/analytics";
import { db } from "@/lib/db";

/** Stock changed — refresh the cached product pages and listings that show it. */
async function revalidateOrderProducts(orderId: string) {
  const items = await db.orderItem.findMany({ where: { orderId }, select: { productSlug: true } });
  for (const i of items) revalidatePath(`/p/${i.productSlug}`);
  revalidatePath("/");
}

export interface RazorpayLaunch {
  key: string;
  razorpayOrderId: string;
  amount: number;
  orderId: string;
  orderNumber: string;
  prefill: { name: string; email: string; contact: string };
}

export type PlaceOrderResult =
  | { ok: true; orderId: string; next: "confirmation" }
  | { ok: true; orderId: string; next: "pay"; razorpay: RazorpayLaunch }
  | { ok: false; error: string };

const placeSchema = z.object({
  addressId: z.string().cuid({ message: "Choose a delivery address." }),
  paymentMethod: z.enum(["COD", "RAZORPAY"], { message: "Choose a payment method." }),
  idempotencyKey: z.string().uuid(),
  buyerGstin: gstinSchema.optional().default(""),
  buyerCompany: z.string().trim().max(120).optional().default(""),
});

function failure(err: unknown): { ok: false; error: string } {
  if (err instanceof OrderError) return { ok: false, error: err.message };
  console.error("[checkout] unexpected error", err);
  return { ok: false, error: "Something went wrong while placing your order. You have not been charged. Please try again." };
}

async function razorpayLaunch(orderId: string, userId: string): Promise<RazorpayLaunch> {
  const { order, razorpayOrderId } = await startOnlinePayment(orderId, userId);
  return {
    key: env().RAZORPAY_KEY_ID!,
    razorpayOrderId,
    amount: order.total,
    orderId: order.id,
    orderNumber: order.orderNumber,
    prefill: { name: order.shipName, email: order.email, contact: order.shipPhone },
  };
}

export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to place your order." };
  if (!(await rateLimit(`place-order:${user.id}`, 10, 600))) return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.buyerGstin && !parsed.data.buyerCompany) return { ok: false, error: "Enter the registered business name for your GSTIN." };
  try {
    const result = await placeOrder(user, {
      addressId: parsed.data.addressId,
      paymentMethod: parsed.data.paymentMethod,
      idempotencyKey: parsed.data.idempotencyKey,
      buyerGstin: parsed.data.buyerGstin || undefined,
      buyerCompany: parsed.data.buyerCompany || undefined,
    });
    revalidatePath("/cart");
    await revalidateOrderProducts(result.orderId);
    if (result.paymentMethod === "COD") return { ok: true, orderId: result.orderId, next: "confirmation" };
    void trackServer({ name: "add_payment_info", userId: user.id, props: { method: "RAZORPAY" } });
    return { ok: true, orderId: result.orderId, next: "pay", razorpay: await razorpayLaunch(result.orderId, user.id) };
  } catch (err) {
    return failure(err);
  }
}

export async function retryPaymentAction(orderId: unknown): Promise<PlaceOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const id = z.string().cuid().safeParse(orderId);
  if (!id.success) return { ok: false, error: "Invalid order." };
  try {
    return { ok: true, orderId: id.data, next: "pay", razorpay: await razorpayLaunch(id.data, user.id) };
  } catch (err) {
    return failure(err);
  }
}

const verifySchema = z.object({
  orderId: z.string().cuid(),
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function verifyPaymentAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid payment response." };
  try {
    await verifyAndConfirmPayment(user.id, parsed.data.orderId, parsed.data);
    revalidatePath(`/account/orders/${parsed.data.orderId}`);
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function reportPaymentFailureAction(input: unknown): Promise<void> {
  const parsed = z.object({ razorpayOrderId: z.string().max(64), reason: z.string().max(500) }).safeParse(input);
  const user = await getCurrentUser();
  if (parsed.success && user) await recordPaymentFailure(parsed.data.razorpayOrderId, parsed.data.reason, user.id);
}

export async function cancelOrderAction(_prev: { error?: string; success?: string }, fd: FormData): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  const id = z.string().cuid().safeParse(fd.get("orderId"));
  const reason = z.string().trim().min(3, "Tell us why you're cancelling.").max(300).safeParse(fd.get("reason"));
  if (!id.success) return { error: "Invalid order." };
  if (!reason.success) return { error: reason.error.issues[0].message };
  try {
    await cancelOrder(id.data, { reason: reason.data, actor: user, byCustomer: true });
    await revalidateOrderProducts(id.data);
    revalidatePath(`/account/orders/${id.data}`);
    revalidatePath("/account/orders");
    return { success: "Your order has been cancelled." };
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Couldn't cancel the order. Please contact support." };
  }
}

export async function requestReturnAction(_prev: { error?: string; success?: string }, fd: FormData): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  const id = z.string().cuid().safeParse(fd.get("orderId"));
  const reason = z.string().trim().min(10, "Please describe the issue (at least 10 characters).").max(500).safeParse(fd.get("reason"));
  if (!id.success) return { error: "Invalid order." };
  if (!reason.success) return { error: reason.error.issues[0].message };
  try {
    await requestReturn(id.data, user, reason.data);
    revalidatePath(`/account/orders/${id.data}`);
    return { success: "Return requested. Our team will contact you to arrange pickup and inspection." };
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Couldn't request a return. Please contact support." };
  }
}
