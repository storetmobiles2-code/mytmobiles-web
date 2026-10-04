import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth/session";

const schema = z.object({
  name: z.enum(ANALYTICS_EVENTS),
  sessionId: z.string().min(1).max(64),
  path: z.string().max(300).optional(),
  productId: z.string().max(40).optional(),
  value: z.number().int().nonnegative().max(1_000_000_000).optional(),
  props: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

/** Client-side analytics sink. Purchases are recorded server-side, not here. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data.name === "purchase") return new NextResponse(null, { status: 400 });
  if (!(await rateLimit(`events:${parsed.data.sessionId}`, 120, 60))) return new NextResponse(null, { status: 429 });
  const user = await getCurrentUser();
  await db.analyticsEvent.create({
    data: { ...parsed.data, props: parsed.data.props ?? undefined, userId: user?.id ?? null },
  });
  return new NextResponse(null, { status: 204 });
}
