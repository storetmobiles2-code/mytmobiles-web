import { NextResponse } from "next/server";
import { lookupPincode } from "@/lib/pincode";
import { estimateDelivery, formatDeliveryDate, PINCODE_PATTERN } from "@/lib/delivery";
import { getSettings } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/pincode/[code]">) {
  const { code } = await ctx.params;
  if (!PINCODE_PATTERN.test(code)) return NextResponse.json({ error: "Enter a valid 6-digit pincode." }, { status: 400 });
  if (!(await rateLimit(`pincode:${await clientIp()}`, 60, 60))) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });

  const [info, settings] = await Promise.all([lookupPincode(code), getSettings()]);
  if (info.isValid === false) return NextResponse.json({ error: `We couldn't find pincode ${code}. Please check and try again.` }, { status: 404 });
  const est = estimateDelivery(code, info.state, settings);
  return NextResponse.json(
    {
      pincode: code,
      city: info.district,
      state: info.state,
      postOffice: info.postOffice,
      serviceable: est.serviceable,
      codAvailable: est.codAvailable,
      estimate: est.serviceable ? { from: est.from.toISOString(), to: est.to.toISOString(), label: `${formatDeliveryDate(est.from)} – ${formatDeliveryDate(est.to)}` } : null,
    },
    { headers: { "cache-control": "private, max-age=600" } },
  );
}
