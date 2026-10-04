import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { expireUnpaidOrders } from "@/lib/orders/service";
import { pruneRateLimits } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Housekeeping, run every ~10 minutes (vercel.json cron or any scheduler):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/expire-orders
 * - Cancels unpaid online orders past their payment window and restocks them
 * - Prunes expired sessions / rate-limit windows / stale guest carts
 */
export async function GET(req: NextRequest) {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
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
