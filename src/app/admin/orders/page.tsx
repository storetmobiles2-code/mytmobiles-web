import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, statusTone } from "@/lib/orders/status";
import { AdminPage, FilterTabs, Table, td, th } from "@/components/admin/ui";
import { Badge, Pagination } from "@/components/ui/misc";

export const metadata = { title: "Orders" };
const PER = 30;
const TABS: (OrderStatus | "ALL")[] = ["ALL", "PENDING_PAYMENT", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURN_REQUESTED", "RETURNED", "CANCELLED"];

export default async function AdminOrders(props: PageProps<"/admin/orders">) {
  const sp = await props.searchParams;
  const status = TABS.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus | "ALL") : "ALL";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.OrderWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(q ? { OR: [{ orderNumber: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { shipPhone: { contains: q } }, { shipName: { contains: q, mode: "insensitive" } }, { invoiceNumber: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [orders, total, counts] = await Promise.all([
    db.order.findMany({ where, orderBy: { placedAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { _count: { select: { items: true } } } }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countOf = (s: string) => (s === "ALL" ? counts.reduce((a, c) => a + c._count._all, 0) : (counts.find((c) => c.status === s)?._count._all ?? 0));
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(status !== "ALL" ? { status } : {}), ...(q ? { q } : {}), ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) });
    return `/admin/orders?${p}`;
  };
  return (
    <AdminPage title="Orders" description={`${total} matching orders`}>
      <form className="flex gap-2" action="/admin/orders">
        {status !== "ALL" && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Search order no., invoice no., name, phone, email" className="h-10 w-full max-w-md rounded-xl border border-ink-300 px-3 text-sm" />
        <button className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white">Search</button>
      </form>
      <FilterTabs active={status} items={TABS.map((t) => ({ key: t, label: t === "ALL" ? "All" : ORDER_STATUS_LABEL[t], count: countOf(t), href: t === "ALL" ? `/admin/orders${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/admin/orders?status=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}` }))} />
      <Table>
        <thead><tr><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Ship to</th><th className={th}>Items</th><th className={th}>Total</th><th className={th}>Payment</th><th className={th}>Status</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-ink-50">
              <td className={td}><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.orderNumber}</Link><span className="block text-xs text-ink-500">{o.placedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span></td>
              <td className={td}>{o.shipName}<span className="block text-xs text-ink-500">{o.shipPhone}</span></td>
              <td className={td}>{o.shipCity}, {o.shipPincode}</td>
              <td className={td}>{o._count.items}</td>
              <td className={`${td} font-semibold`}>{formatINR(o.total)}</td>
              <td className={td}>{o.paymentMethod}<span className="block text-xs text-ink-500">{PAYMENT_STATUS_LABEL[o.paymentStatus]}</span></td>
              <td className={td}><Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td className={td} colSpan={7}>No orders found.</td></tr>}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => qs({ page: p })} />
    </AdminPage>
  );
}
