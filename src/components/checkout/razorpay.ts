"use client";

import type { RazorpayLaunch } from "@/app/actions/orders";

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (resp: { error: { description: string } }) => void) => void };
  }
}

let loader: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return loader;
}

export type RazorpayOutcome = { status: "paid"; response: RazorpaySuccess } | { status: "dismissed" } | { status: "failed"; reason: string };

/** Opens Razorpay Checkout and resolves with what the shopper did. */
export async function openRazorpay(launch: RazorpayLaunch): Promise<RazorpayOutcome> {
  await loadScript();
  return new Promise((resolve) => {
    let settled = false;
    // With retries enabled, "payment.failed" fires per attempt while the modal stays open;
    // only success or closing the modal ends the flow.
    let lastFailure: string | null = null;
    const done = (o: RazorpayOutcome) => {
      if (!settled) {
        settled = true;
        resolve(o);
      }
    };
    const rzp = new window.Razorpay!({
      key: launch.key,
      order_id: launch.razorpayOrderId,
      amount: launch.amount,
      currency: "INR",
      name: "myT Mobiles",
      description: `Order ${launch.orderNumber}`,
      prefill: launch.prefill,
      notes: { orderNumber: launch.orderNumber },
      theme: { color: "#d10f68" },
      handler: (response: RazorpaySuccess) => done({ status: "paid", response }),
      modal: { ondismiss: () => done(lastFailure ? { status: "failed", reason: lastFailure } : { status: "dismissed" }), confirm_close: true },
      retry: { enabled: true, max_count: 3 },
    });
    rzp.on("payment.failed", (resp) => {
      lastFailure = resp.error.description;
    });
    rzp.open();
  });
}
