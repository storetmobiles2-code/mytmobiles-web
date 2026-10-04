import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Minimal Razorpay REST client (Orders, Payments, Refunds) and signature checks.
 * Docs: https://razorpay.com/docs/api/
 */
const API = "https://api.razorpay.com/v1";

function credentials() {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = env();
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) throw new Error("Razorpay is not configured");
  return { keyId: RAZORPAY_KEY_ID, keySecret: RAZORPAY_KEY_SECRET };
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const { keyId, keySecret } = credentials();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new Error(`Razorpay ${method} ${path} failed (${res.status}): ${json.error?.description ?? "unknown error"}`);
  return json;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string;
  error_description?: string | null;
}

export function createOrder(amount: number, receipt: string, notes: Record<string, string>) {
  return call<RazorpayOrder>("POST", "/orders", { amount, currency: "INR", receipt, notes });
}

export function fetchPayment(paymentId: string) {
  return call<RazorpayPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`);
}

export function capturePayment(paymentId: string, amount: number) {
  return call<RazorpayPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency: "INR" });
}

export function refundPayment(paymentId: string, amount: number, notes: Record<string, string>) {
  return call<{ id: string; amount: number; status: string }>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, {
    amount,
    speed: "normal",
    notes,
  });
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret = credentials().keySecret) {
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
