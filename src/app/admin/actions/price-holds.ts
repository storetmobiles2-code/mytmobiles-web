"use server";

import { z } from "zod";
import { assertPermission } from "@/lib/auth/guards";
import { decidePriceHold } from "@/lib/catalog/price-holds";
import { revalidateStorefront } from "@/lib/admin/revalidate";

/** Approve or reject a POS price the sync held (Admin → Inventory → Held prices). */
export async function decideHeldPrice(_prev: { ok?: string; error?: string }, fd: FormData): Promise<{ ok?: string; error?: string }> {
  const admin = await assertPermission("products.edit");
  const parsed = z.object({ id: z.string().cuid(), decision: z.enum(["approve", "reject"]) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Choose approve or reject." };
  const r = await decidePriceHold(parsed.data.id, parsed.data.decision, admin, admin.email);
  if ("error" in r) return { error: r.error };
  if (parsed.data.decision === "approve") revalidateStorefront();
  return { ok: r.ok };
}
