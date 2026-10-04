import Link from "next/link";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { AdminPage, Panel, Stat } from "@/components/admin/ui";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage(props: PageProps<"/admin/analytics">) {
  const days = [7, 30, 90].includes(Number((await props.searchParams).days)) ? Number((await props.searchParams).days) : 30;
  const since = new Date(Date.now() - days * 86400_000);
  const [sessions, views, topViewed, topSold, searches, revenue] = await Promise.all([
    db.analyticsEvent.findMany({ where: { createdAt: { gte: since }, name: "page_view" }, distinct: ["sessionId"], select: { sessionId: true } }).then((r) => r.length),
    db.analyticsEvent.count({ where: { createdAt: { gte: since }, name: "page_view" } }),
    db.analyticsEvent.groupBy({ by: ["productId"], where: { createdAt: { gte: since }, name: "view_item", productId: { not: null } }, _count: { _all: true }, orderBy: { _count: { productId: "desc" } }, take: 10 }),
    db.orderItem.groupBy({ by: ["productName"], where: { order: { placedAt: { gte: since }, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } } }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { lineTotal: "desc" } }, take: 10 }),
    db.analyticsEvent.findMany({ where: { createdAt: { gte: since }, name: "search" }, select: { props: true }, take: 2000 }),
    db.order.aggregate({ where: { placedAt: { gte: since }, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } }, _sum: { total: true }, _count: true }),
  ]);
  const names = await db.product.findMany({ where: { id: { in: topViewed.map((t) => t.productId!) } }, select: { id: true, name: true, slug: true } });
  const terms = new Map<string, number>();
  for (const s of searches) {
    const q = String((s.props as { q?: string } | null)?.q ?? "").toLowerCase().trim();
    if (q) terms.set(q, (terms.get(q) ?? 0) + 1);
  }
  const topTerms = [...terms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const conv = sessions ? ((revenue._count / sessions) * 100).toFixed(2) : "0";
  return (
    <AdminPage title="Analytics" description="First-party, cookie-less analytics. Revenue counts confirmed orders (excludes cancelled/unpaid)." actions={[7, 30, 90].map((d) => <Link key={d} href={`/admin/analytics?days=${d}`} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${d === days ? "bg-ink-900 text-white" : "bg-white text-ink-700"}`}>{d} days</Link>)}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sessions" value={sessions.toLocaleString("en-IN")} />
        <Stat label="Page views" value={views.toLocaleString("en-IN")} />
        <Stat label="Orders" value={revenue._count} hint={`${conv}% of sessions`} />
        <Stat label="Revenue" value={formatINR(revenue._sum.total ?? 0)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Most viewed products"><ol className="list-decimal space-y-1 pl-5 text-sm">{topViewed.map((t) => { const p = names.find((n) => n.id === t.productId); return <li key={t.productId}>{p ? <Link href={`/p/${p.slug}`} className="hover:text-brand-700">{p.name}</Link> : "—"} <span className="text-ink-500">({t._count._all})</span></li>; })}</ol></Panel>
        <Panel title="Best sellers (revenue)"><ol className="list-decimal space-y-1 pl-5 text-sm">{topSold.map((t) => <li key={t.productName}>{t.productName} <span className="text-ink-500">· {t._sum.quantity} sold · {formatINR(t._sum.lineTotal ?? 0)}</span></li>)}</ol></Panel>
        <Panel title="Top searches"><ol className="list-decimal space-y-1 pl-5 text-sm">{topTerms.map(([q, n]) => <li key={q}><Link href={`/search?q=${encodeURIComponent(q)}`} className="hover:text-brand-700">{q}</Link> <span className="text-ink-500">({n})</span></li>)}</ol></Panel>
      </div>
    </AdminPage>
  );
}
