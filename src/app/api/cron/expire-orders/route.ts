import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { expireUnpaidOrders } from "@/lib/orders/service";
import { pruneRateLimits } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { bearerMatches } from "@/lib/sync/bearer";

export const dynamic = "force-dynamic";

/**
 * Housekeeping, run every ~10 minutes (vercel.json cron or any scheduler):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/expire-orders
 * EXPIRE_ORDERS_SECRET (optional) is accepted here too and authorises only this route.
 * - Cancels unpaid online orders past their payment window and restocks them
 * - Prunes expired sessions / rate-limit windows / stale guest carts
 */
export async function GET(req: NextRequest) {
  const { CRON_SECRET, EXPIRE_ORDERS_SECRET } = env();
  if (!bearerMatches(req, CRON_SECRET) && !bearerMatches(req, EXPIRE_ORDERS_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await expireUnpaidOrders();
  const [sessions, limits, carts] = await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    pruneRateLimits(),
    db.cart.deleteMany({ where: { userId: null, updatedAt: { lt: new Date(Date.now() - 60 * 86400_000) } } }),
  ]);
  return NextResponse.json({ expiredOrders: expired, prunedSessions: sessions.count, prunedRateLimits: limits, prunedGuestCarts: carts.count });
}
