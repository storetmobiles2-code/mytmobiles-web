import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import type { GrievanceStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { overdueCandidatesWhere } from "@/lib/grievances/service";
import { ageLabel, formatIST, GRIEVANCE_CATEGORY_LABEL, GRIEVANCE_STATUS_LABEL, GRIEVANCE_STATUSES, grievanceFlags, grievanceStatusTone, isOverdue } from "@/lib/grievances/rules";
import { AdminPage, FilterTabs, Table, td, th } from "@/components/admin/ui";
import { Badge, Pagination } from "@/components/ui/misc";

export const metadata = { title: "Grievances" };
const PER = 30;
type Tab = GrievanceStatus | "ALL" | "OVERDUE";
const TABS: Tab[] = ["ALL", "OVERDUE", ...GRIEVANCE_STATUSES];

export default async function AdminGrievances(props: PageProps<"/admin/grievances">) {
  const sp = await props.searchParams;
  const tab: Tab = TABS.includes(sp.status as Tab) ? (sp.status as Tab) : "ALL";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const now = new Date();

  const search: Prisma.GrievanceWhereInput = q
    ? { OR: [{ ticket: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { orderNumber: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] }
    : {};
  const select = { id: true, ticket: true, name: true, email: true, orderNumber: true, category: true, status: true, createdAt: true, acknowledgedAt: true } as const;

  const [counts, candidates] = await Promise.all([
    db.grievance.groupBy({ by: ["status"], _count: { _all: true } }),
    db.grievance.findMany({ where: { AND: [overdueCandidatesWhere(now), search] }, select, orderBy: { createdAt: "asc" } }),
  ]);
  const overdue = candidates.filter((g) => isOverdue(g, now));

  let rows;
  let total;
  if (tab === "OVERDUE") {
    total = overdue.length;
    rows = overdue.slice((page - 1) * PER, page * PER);
  } else {
    const where: Prisma.GrievanceWhereInput = { ...(tab !== "ALL" ? { status: tab } : {}), ...search };
    [rows, total] = await Promise.all([
      db.grievance.findMany({ where, select, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER }),
      db.grievance.count({ where }),
    ]);
  }

  const countOf = (t: Tab) => (t === "OVERDUE" ? overdue.length : t === "ALL" ? counts.reduce((a, c) => a + c._count._all, 0) : (counts.find((c) => c.status === t)?._count._all ?? 0));
  const href = (t: Tab, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ ...(t !== "ALL" ? { status: t } : {}), ...(q ? { q } : {}), ...extra });
    return `/admin/grievances${p.size ? `?${p}` : ""}`;
  };

  return (
    <AdminPage title="Grievances" description="Acknowledge within 48 hours and resolve within one month (Consumer Protection (E-Commerce) Rules, 2020).">
      <form className="flex gap-2" action="/admin/grievances">
        {tab !== "ALL" && <input type="hidden" name="status" value={tab} />}
        <input name="q" defaultValue={q} aria-label="Search complaints" placeholder="Search ticket, name, email, phone, order no." className="h-10 w-full max-w-md rounded-xl border border-ink-300 px-3 text-sm" />
        <button className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white">Search</button>
      </form>
      <FilterTabs active={tab} items={TABS.map((t) => ({ key: t, label: t === "ALL" ? "All" : t === "OVERDUE" ? "Overdue" : GRIEVANCE_STATUS_LABEL[t], count: countOf(t), href: href(t) }))} />
      <Table>
        <thead><tr><th className={th}>Ticket</th><th className={th}>From</th><th className={th}>About</th><th className={th}>Age</th><th className={th}>Status</th></tr></thead>
        <tbody>
          {rows.map((g) => {
            const f = grievanceFlags(g, now);
            return (
              <tr key={g.id} className="hover:bg-ink-50">
                <td className={td}><Link href={`/admin/grievances/${g.id}`} className="font-mono font-semibold text-brand-700 hover:underline">{g.ticket}</Link><span className="block text-xs text-ink-500">{formatIST(g.createdAt)}</span></td>
                <td className={td}>{g.name}<span className="block text-xs text-ink-500">{g.email}</span></td>
                <td className={td}>{GRIEVANCE_CATEGORY_LABEL[g.category]}{g.orderNumber && <span className="block font-mono text-xs text-ink-500">{g.orderNumber}</span>}</td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>{ageLabel(g.createdAt, now)}</td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={grievanceStatusTone(g.status)}>{GRIEVANCE_STATUS_LABEL[g.status]}</Badge>
                    {f.ackOverdue && <Badge tone="danger">Not acknowledged in 48 h</Badge>}
                    {f.resolveOverdue && <Badge tone="danger">Past 1-month deadline</Badge>}
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td className={td} colSpan={5}>No complaints found.</td></tr>}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => href(tab, { page: String(p) })} />
    </AdminPage>
  );
}
