import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { ORDER_STATUS_LABEL, statusTone } from "@/lib/orders/status";
import { setUserDisabled, setUserRole } from "@/app/admin/actions/store";
import { AdminPage, Panel, Stat } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Customer" };

export default async function CustomerPage(props: PageProps<"/admin/customers/[id]">) {
  const { id } = await props.params;
  const user = await db.user.findUnique({ where: { id }, include: { orders: { orderBy: { placedAt: "desc" }, take: 50 }, addresses: true } });
  if (!user) notFound();
  const spent = user.orders.filter((o) => o.status !== "CANCELLED" && o.status !== "PENDING_PAYMENT").reduce((s, o) => s + o.total, 0);
  return (
    <AdminPage
      title={user.name}
      description={`${user.email}${user.phone ? ` · ${user.phone}` : ""} · joined ${user.createdAt.toLocaleDateString("en-IN")}`}
      actions={
        <>
          <ActionButton run={setUserDisabled.bind(null, user.id, !user.isDisabled)} confirmText={user.isDisabled ? "Enable this account?" : "Disable this account and sign it out everywhere?"} className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-sm font-semibold">{user.isDisabled ? "Enable account" : "Disable account"}</ActionButton>
          <ActionButton run={setUserRole.bind(null, user.id, user.role === "ADMIN" ? "CUSTOMER" : "ADMIN")} confirmText={user.role === "ADMIN" ? "Remove admin access?" : "Give this user full admin access?"} className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-sm font-semibold">{user.role === "ADMIN" ? "Remove admin" : "Make admin"}</ActionButton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Orders" value={user.orders.length} />
        <Stat label="Lifetime value" value={formatINR(spent)} />
        <Stat label="Email" value={user.emailVerifiedAt ? "Verified" : "Unverified"} />
        <Stat label="Marketing" value={user.marketingOptIn ? "Opted in" : "No"} />
      </div>
      <Panel title="Orders">
        <ul className="divide-y divide-ink-100 text-sm">
          {user.orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 py-2">
              <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700">{o.orderNumber}</Link>
              <span>{o.placedAt.toLocaleDateString("en-IN")}</span>
              <span>{formatINR(o.total)}</span>
              <Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge>
            </li>
          ))}
          {user.orders.length === 0 && <li className="py-2 text-ink-500">No orders.</li>}
        </ul>
      </Panel>
      <Panel title="Addresses">
        <ul className="space-y-2 text-sm">{user.addresses.map((a) => <li key={a.id}>{a.fullName}, {[a.line1, a.line2, a.city, `${a.state} ${a.pincode}`].filter(Boolean).join(", ")} · {a.phone}</li>)}</ul>
      </Panel>
    </AdminPage>
  );
}
