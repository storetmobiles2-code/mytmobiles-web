import "server-only";
import { db } from "./db";

export const ANALYTICS_EVENTS = [
  "page_view",
  "view_item",
  "search",
  "add_to_cart",
  "remove_from_cart",
  "add_to_wishlist",
  "begin_checkout",
  "add_payment_info",
  "purchase",
  "sign_up",
  "login",
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Server-side event (e.g. purchase), so revenue reporting doesn't depend on ad-blockable JS. */
export async function trackServer(event: {
  name: AnalyticsEventName;
  sessionId?: string;
  userId?: string | null;
  path?: string;
  productId?: string;
  value?: number;
  props?: Record<string, string | number | boolean>;
}): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        name: event.name,
        sessionId: event.sessionId ?? "server",
        userId: event.userId ?? null,
        path: event.path,
        productId: event.productId,
        value: event.value,
        props: event.props,
      },
    });
  } catch (err) {
    console.error("[analytics] failed to record event", event.name, err);
  }
}
