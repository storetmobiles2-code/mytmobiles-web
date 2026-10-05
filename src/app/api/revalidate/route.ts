import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Lets tooling outside the app (`npm run catalog -- apply --write --revalidate`,
 * CI) refresh cached storefront pages after it writes catalogue data.
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" -d '{"tags":["catalog"]}' https://<site>/api/revalidate
 */
export async function POST(req: NextRequest) {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = z.object({ tags: z.array(z.enum(["catalog", "settings"])).default(["catalog"]) }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  // Expire immediately: the next visitor gets fresh data rather than one more stale page.
  for (const tag of body.data.tags) revalidateTag(tag, { expire: 0 });
  revalidatePath("/", "layout");
  return NextResponse.json({ revalidated: body.data.tags });
}
