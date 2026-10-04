import Link from "next/link";
import { db } from "@/lib/db";
import { AdminPage, Table, td, th } from "@/components/admin/ui";
import { Badge, Pagination } from "@/components/ui/misc";

export const metadata = { title: "Customers" };
const PER = 40;

export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }] } : {};
  const [users, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { _count: { select: { orders: true } } } }),
    db.user.count({ where }),
  ]);
  return (
    <AdminPage title="Customers" description={`${total} accounts`}>
      <form className="flex gap-2" action="/admin/customers"><input name="q" defaultValue={q} placeholder="Search name, email, phone" className="h-10 w-full max-w-md rounded-xl border border-ink-300 px-3 text-sm" /><button className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white">Search</button></form>
      <Table>
        <thead><tr><th className={th}>Name</th><th className={th}>Contact</th><th className={th}>Orders</th><th className={th}>Joined</th><th className={th}>Status</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className={td}><Link href={`/admin/customers/${u.id}`} className="font-semibold text-brand-700 hover:underline">{u.name}</Link>{u.role === "ADMIN" && <Badge tone="brand" className="ml-2">Admin</Badge>}</td>
              <td className={td}>{u.email}<span className="block text-xs text-ink-500">{u.phone}</span></td>
              <td className={td}>{u._count.orders}</td>
              <td className={td}>{u.createdAt.toLocaleDateString("en-IN")}</td>
              <td className={td}>{u.isDisabled ? <Badge tone="danger">Disabled</Badge> : u.emailVerifiedAt ? <Badge tone="success">Verified</Badge> : <Badge>Unverified</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(n) => `/admin/customers?page=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
    </AdminPage>
  );
}
