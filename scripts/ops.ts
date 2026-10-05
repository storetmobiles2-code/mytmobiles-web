/**
 * Daily operations brief for staff and the ops-monitor agent. Read-only.
 *
 *   npm run ops -- report [--json] [--site https://www.example.com]
 *
 * Lists what needs a person today: orders waiting to be packed or shipped,
 * deliveries running late, returns and refunds pending, payments stuck,
 * low stock, and whether the site and its scheduled job are healthy.
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { setupGaps } from "@/lib/settings";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const option = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

interface Item {
  severity: "urgent" | "today" | "info";
  title: string;
  detail: string[];
}

async function siteHealth(site: string | undefined): Promise<Item | null> {
  if (!site) return null;
  const base = site.replace(/\/$/, "");
  const started = Date.now();
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10_000) });
    const ms = Date.now() - started;
    if (!res.ok) return { severity: "urgent", title: `Site health check failed (HTTP ${res.status})`, detail: [`${base}/api/health`] };
    return ms > 3000 ? { severity: "today", title: `Site is slow to respond (${ms} ms)`, detail: [] } : { severity: "info", title: `Site is up (${ms} ms)`, detail: [] };
  } catch (e) {
    return { severity: "urgent", title: "Site is unreachable", detail: [`${base}: ${(e as Error).message}`] };
  }
}

async function main() {
  const now = new Date();
  const list = (rows: { orderNumber: string; total: number; placedAt: Date; shipName: string }[]) =>
    rows.map((o) => `${o.orderNumber} · ${formatINR(o.total)} · ${o.shipName} · placed ${o.placedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`);
  const orderSel = { orderNumber: true, total: true, placedAt: true, shipName: true } as const;

  const [toPack, toShip, late, returns, refunds, stuckPayments, lowStock, settings, last24, last7] = await Promise.all([
    db.order.findMany({ where: { status: "CONFIRMED", confirmedAt: { lt: hoursAgo(24) } }, select: orderSel, orderBy: { placedAt: "asc" } }),
    db.order.findMany({ where: { status: "PACKED", updatedAt: { lt: hoursAgo(24) } }, select: orderSel, orderBy: { placedAt: "asc" } }),
    db.order.findMany({ where: { status: { in: ["SHIPPED", "OUT_FOR_DELIVERY"] }, estimatedDeliveryTo: { lt: now } }, select: { ...orderSel, courierName: true, trackingNumber: true } }),
    db.order.findMany({ where: { status: "RETURN_REQUESTED" }, select: { ...orderSel, returnReason: true } }),
    db.order.findMany({ where: { paymentStatus: "REFUND_PENDING" }, select: { ...orderSel, paymentMethod: true } }),
    // The cron releases these; any still here means it isn't running.
    db.order.findMany({ where: { status: "PENDING_PAYMENT", paymentExpiresAt: { lt: hoursAgo(1) } }, select: orderSel }),
    db.productVariant.findMany({
      where: { isActive: true, product: { isActive: true } },
      select: { sku: true, stock: true, lowStockThreshold: true, product: { select: { name: true } } },
    }),
    db.storeSettings.findUnique({ where: { id: "store" } }),
    db.order.aggregate({ where: { placedAt: { gte: hoursAgo(24) }, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } }, _sum: { total: true }, _count: true }),
    db.order.aggregate({ where: { placedAt: { gte: hoursAgo(24 * 7) }, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } }, _sum: { total: true }, _count: true }),
  ]);

  const items: Item[] = [];
  const add = (severity: Item["severity"], title: string, detail: string[]) => detail.length && items.push({ severity, title: `${title}: ${detail.length}`, detail });
  add("urgent", "Confirmed over 24 h ago and not packed", list(toPack));
  add("urgent", "Packed over 24 h ago and not shipped", list(toShip));
  add("urgent", "Payment window over but order still pending (is the cron running?)", list(stuckPayments));
  add("today", "Past the promised delivery date", late.map((o) => `${list([o])[0]} · ${o.courierName ?? "?"} ${o.trackingNumber ?? ""}`));
  add("today", "Return requests to review", returns.map((o) => `${list([o])[0]} · "${o.returnReason ?? ""}"`));
  add("today", "Refunds pending", refunds.map((o) => `${list([o])[0]} · ${o.paymentMethod === "COD" ? "COD: pay by bank transfer, then mark refunded" : "Razorpay refund in progress"}`));
  // A single shop holds one or two units of most models, so list sell-outs and just count the rest.
  const soldOut = lowStock.filter((v) => v.stock === 0);
  const low = lowStock.filter((v) => v.stock > 0 && v.stock <= v.lowStockThreshold);
  add("info", "Variants sold out on live products (restock or expect them to show as unavailable)", soldOut.map((v) => `${v.product.name} · ${v.sku}`));
  if (low.length) items.push({ severity: "info", title: `${low.length} variant(s) at or below their low-stock level`, detail: [] });
  if (settings) add("today", "Store setup incomplete", setupGaps(settings));
  const health = await siteHealth(option("site") ?? process.env.NEXT_PUBLIC_SITE_URL);
  if (health) items.push(health);

  const summary = {
    generatedAt: now.toISOString(),
    sales: { last24h: { orders: last24._count, value: last24._sum.total ?? 0 }, last7d: { orders: last7._count, value: last7._sum.total ?? 0 } },
    items,
  };
  if (flag("json")) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Operations brief — ${now.toISOString().slice(0, 16).replace("T", " ")} UTC`);
    console.log(`Sales: last 24 h ${last24._count} orders · ${formatINR(last24._sum.total ?? 0)}; last 7 days ${last7._count} · ${formatINR(last7._sum.total ?? 0)}\n`);
    const order = { urgent: 0, today: 1, info: 2 };
    for (const it of items.sort((a, b) => order[a.severity] - order[b.severity])) {
      console.log(`${it.severity === "urgent" ? "‼" : it.severity === "today" ? "•" : "·"} ${it.title}`);
      for (const d of it.detail.slice(0, 25)) console.log(`    ${d}`);
      if (it.detail.length > 25) console.log(`    … and ${it.detail.length - 25} more`);
    }
    if (!items.some((i) => i.severity !== "info")) console.log("✓ Nothing needs attention.");
  }
  if (items.some((i) => i.severity === "urgent")) process.exitCode = 2;
}

main()
  .catch((e) => {
    console.error(`✗ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
