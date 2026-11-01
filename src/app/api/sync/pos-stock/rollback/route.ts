import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { bearerMatches } from "@/lib/sync/bearer";
import { rollbackPosSync } from "@/lib/catalog/price-holds";

export const dynamic = "force-dynamic";

const ROLLBACK_ACTOR = { email: "pos-sync canary (rollback)" } as const;

/**
 * Undo the price changes of one POS sync, by the `auditId` that
 * POST /api/sync/pos-stock returned. The canary calls this when the pages look
 * wrong after a sync. Prices still at the synced value are restored; stock is
 * never rolled back. Safe to repeat.
 *
 *   curl -X POST -H "Authorization: Bearer $POS_SYNC_SECRET" -H "Content-Type: application/json" \
 *     -d '{"auditId":"…"}' https://<site>/api/sync/pos-stock/rollback
 */
export async function POST(req: NextRequest) {
  const e = env();
  if (!bearerMatches(req, e.POS_SYNC_SECRET) && !bearerMatches(req, e.HARNESS_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ auditId: z.string().trim().min(1).max(64) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const r = await rollbackPosSync(parsed.data.auditId, ROLLBACK_ACTOR);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.restored) {
    revalidateTag("catalog", { expire: 0 });
    revalidatePath("/", "layout");
  }
  return NextResponse.json(r);
}
