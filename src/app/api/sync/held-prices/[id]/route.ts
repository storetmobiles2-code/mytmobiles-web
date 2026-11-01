import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { bearerMatches } from "@/lib/sync/bearer";
import { decidePriceHold } from "@/lib/catalog/price-holds";

export const dynamic = "force-dynamic";

const body = z.object({
  decision: z.enum(["approve", "reject"]),
  /** Who pressed the button, e.g. "discord:owner_name" */
  approver: z.string().trim().min(3).max(120),
});

/**
 * Approve or reject one held POS price (the approval bot's buttons). ₹0 and
 * above-MRP prices can only be rejected.
 *
 *   curl -X POST -H "Authorization: Bearer $HARNESS_SECRET" -H "Content-Type: application/json" \
 *     -d '{"decision":"approve","approver":"discord:owner"}' https://<site>/api/sync/held-prices/<id>
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/sync/held-prices/[id]">) {
  if (!bearerMatches(req, env().HARNESS_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const { decision, approver } = parsed.data;
  const r = await decidePriceHold(id, decision, { email: `approval-bot (${approver})`.slice(0, 190) }, approver);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (decision === "approve") {
    revalidateTag("catalog", { expire: 0 });
    revalidatePath("/", "layout");
  }
  return NextResponse.json({ ok: r.ok });
}
