import type { Metadata } from "next";
import { Package } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { OrderRow } from "@/components/account/order-row";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };
const PER_PAGE = 15;

export default async function OrdersPage(props: PageProps<"/account/orders">) {
  const user = await requireUser("/account/orders");
  const page = Math.max(1, Number((await props.searchParams).page) || 1);
  const [orders, total] = await Promise.all([
    db.order.findMany({ where: { userId: user.id }, orderBy: { placedAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { items: { select: { productName: true, imageUrl: true, quantity: true } } } }),
    db.order.count({ where: { userId: user.id } }),
  ]);
  return (
    <section className="card p-5">
      <h1 className="text-xl font-extrabold">My orders</h1>
      {orders.length ? (
        <>
          <ul className="mt-3 divide-y divide-ink-100">{orders.map((o) => <OrderRow key={o.id} order={o} />)}</ul>
          <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/account/orders?page=${p}`} />
        </>
      ) : (
        <div className="mt-4"><EmptyState icon={<Package className="h-7 w-7" />} title="No orders yet" action={<ButtonLink href="/">Start shopping</ButtonLink>} /></div>
      )}
    </section>
  );
}
