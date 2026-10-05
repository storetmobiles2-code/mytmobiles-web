"use client";

import { DEMO } from "@/lib/demo";

/** First-party analytics: cookie-less, per-tab session id, no PII. Mirrors key events to GA4 when configured. */
type Props = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("myt_sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("myt_sid", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function track(name: string, props: Props & { productId?: string; value?: number } = {}) {
  if (DEMO) return;
  const { productId, value, ...rest } = props;
  const body = JSON.stringify({ name, sessionId: sessionId(), path: location.pathname, productId, value, props: rest });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    else void fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
  } catch {
    /* analytics must never break the page */
  }
  window.gtag?.("event", name, { ...rest, value: value !== undefined ? value / 100 : undefined, currency: value !== undefined ? "INR" : undefined });
}
