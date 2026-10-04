import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { daysAgo } from "@/lib/time";
import { getSettings, setupGaps } from "@/lib/settings";
import { razorpayConfigured, smtpConfigured } from "@/lib/env";
import { formatINR } from "@/lib/money";
import { ORDER_STATUS_LABEL, statusTone } from "@/lib/orders/status";
import { AdminPage, Panel, Stat, Table, td, th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";

export default async function AdminDashboard() {
  const since30 = daysAgo(30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const countedStatuses = { notIn: ["CANCELLED", "PENDING_PAYMENT"] as ("CANCELLED" | "PENDING_PAYMENT")[] };
  const [settings, rev30, revToday, toPack, toShip, returns, lowStock, recent, funnelRows] = await Promise.all([
    getSettings(),
    db.order.aggregate({ where: { placedAt: { gte: since30 }, status: countedStatuses }, _sum: { total: true }, _count: true }),
    db.order.aggregate({ where: { placedAt: { gte: today }, status: countedStatuses }, _sum: { total: true }, _count: true }),
    db.order.count({ where: { status: "CONFIRMED" } }),
    db.order.count({ where: { status: "PACKED" } }),
    db.order.count({ where: { status: "RETURN_REQUESTED" } }),
    db.productVariant.count({ where: { isActive: true, product: { isActive: true }, stock: { lte: 2 } } }),
    db.order.findMany({ orderBy: { placedAt: "desc" }, take: 8, select: { id: true, orderNumber: true, shipName: true, total: true, status: true, paymentMethod: true, placedAt: true } }),
    db.analyticsEvent.groupBy({ by: ["name"], where: { createdAt: { gte: since30 }, name: { in: ["view_item", "add_to_cart", "begin_checkout", "purchase"] } }, _count: { _all: true } }),
  ]);
  const gaps = setupGaps(settings);
  if (!razorpayConfigured()) gaps.push("Razorpay keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) — online payments are hidden until set");
  if (!smtpConfigured()) gaps.push("SMTP email (SMTP_HOST / EMAIL_FROM) — order and password emails are not being sent");
  const funnel = ["view_item", "add_to_cart", "begin_checkout", "purchase"].map((n) => ({ name: n, count: funnelRows.find((r) => r.name === n)?._count._all ?? 0 }));
  const aov = rev30._count ? Math.round((rev30._sum.total ?? 0) / rev30._count) : 0;

  return (
    <AdminPage title="Dashboard">
      {gaps.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Finish setting up before going live</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">{gaps.map((g) => <li key={g}>{g}</li>)}</ul>
          <Link href="/admin/settings" className="mt-2 inline-block font-semibold underline">Open settings</Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today" value={formatINR(revToday._sum.total ?? 0)} hint={`${revToday._count} orders`} />
        <Stat label="Last 30 days" value={formatINR(rev30._sum.total ?? 0)} hint={`${rev30._count} orders · AOV ${formatINR(aov)}`} />
        <Stat label="To pack" value={toPack} hint="Confirmed orders" href="/admin/orders?status=CONFIRMED" />
        <Stat label="To ship" value={toShip} hint="Packed orders" href="/admin/orders?status=PACKED" />
        <Stat label="Return requests" value={returns} href="/admin/orders?status=RETURN_REQUESTED" />
        <Stat label="Low stock variants" value={lowStock} hint="≤ 2 units, live products" href="/admin/inventory?filter=low" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-sm font-semibold text-brand-700">All orders</Link>}>
          <Table>
            <thead><tr><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Total</th><th className={th}>Status</th></tr></thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td className={td}><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.orderNumber}</Link><span className="block text-xs text-ink-500">{o.placedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span></td>
                  <td className={td}>{o.shipName}</td>
                  <td className={td}>{formatINR(o.total)} <span className="text-xs text-ink-500">{o.paymentMethod}</span></td>
                  <td className={td}><Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td className={td} colSpan={4}>No orders yet.</td></tr>}
            </tbody>
          </Table>
        </Panel>
        <Panel title="Conversion funnel (30 days)">
          <ol className="space-y-3">
            {funnel.map((f, i) => {
              const base = funnel[0].count || 1;
              const pct = Math.round((f.count / base) * 100);
              return (
                <li key={f.name}>
                  <div className="flex justify-between text-sm"><span>{["Product views", "Add to cart", "Checkout started", "Purchases"][i]}</span><span className="font-semibold tabular-nums">{f.count.toLocaleString("en-IN")} {i > 0 && <span className="text-ink-500">({pct}%)</span>}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-ink-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.max(2, pct)}%` }} /></div>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-ink-500">First-party, cookie-less events. See <Link href="/admin/analytics" className="underline">Analytics</Link> for top products and searches.</p>
        </Panel>
      </div>
    </AdminPage>
  );
}
