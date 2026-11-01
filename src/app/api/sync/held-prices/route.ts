import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { bearerMatches } from "@/lib/sync/bearer";
import { pendingPriceHolds } from "@/lib/catalog/price-holds";

export const dynamic = "force-dynamic";

/**
 * Held POS prices waiting for the owner, for the approval bot. Prices in rupees.
 *
 *   curl -H "Authorization: Bearer $HARNESS_SECRET" https://<site>/api/sync/held-prices
 */
export async function GET(req: NextRequest) {
  if (!bearerMatches(req, env().HARNESS_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const holds = await pendingPriceHolds();
  return NextResponse.json({
    holds: holds.map((h) => ({
      id: h.id,
      sku: h.sku,
      product: h.variant.product.name,
      slug: h.variant.product.slug,
      variant: [h.variant.ram, h.variant.storage, h.variant.color].filter(Boolean).join(" · "),
      priceBefore: h.priceBefore / 100,
      priceAfter: h.priceAfter / 100,
      mrp: h.variant.mrp / 100,
      reason: h.reason,
      label: h.label,
      approvable: h.approvable,
      createdAt: h.createdAt.toISOString(),
    })),
  });
}
