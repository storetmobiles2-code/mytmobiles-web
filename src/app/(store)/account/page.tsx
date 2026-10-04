import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { OrderRow } from "@/components/account/order-row";
import { ResendVerification } from "@/components/account/resend-verification";
import { EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage(props: PageProps<"/account">) {
  const user = await requireUser("/account");
  const sp = await props.searchParams;
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { placedAt: "desc" }, take: 5, include: { items: { select: { productName: true, imageUrl: true, quantity: true } } } });
  return (
    <div className="space-y-4">
      {sp.reset && <p role="status" className="rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700">Your password has been updated.</p>}
      {!user.emailVerified && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>Please verify <strong>{user.email}</strong> so we can send order updates.</span>
          <ResendVerification />
        </div>
      )}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold">Recent orders</h1>
          <Link href="/account/orders" className="text-sm font-semibold text-brand-700 hover:underline">All orders</Link>
        </div>
        {orders.length ? (
          <ul className="mt-3 divide-y divide-ink-100">{orders.map((o) => <OrderRow key={o.id} order={o} />)}</ul>
        ) : (
          <div className="mt-4"><EmptyState icon={<Package className="h-7 w-7" />} title="No orders yet" action={<ButtonLink href="/">Start shopping</ButtonLink>} /></div>
        )}
      </section>
    </div>
  );
}
