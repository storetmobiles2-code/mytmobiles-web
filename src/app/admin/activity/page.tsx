import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { auditEntityHref } from "@/lib/admin/audit-diff";
import { AdminPage, Table, td, th } from "@/components/admin/ui";
import { AuditChangesList } from "@/components/admin/audit-history";
import { Pagination } from "@/components/ui/misc";

export const metadata = { title: "Activity" };
const PER = 50;

const str = (v: string | string[] | undefined, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const field = "mt-1 h-10 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm";

export default async function ActivityPage(props: PageProps<"/admin/activity">) {
  await requirePermission("audit.view");
  const sp = await props.searchParams;
  const f = { actor: str(sp.actor, 190), action: str(sp.action, 64), entity: str(sp.entity, 40), entityId: str(sp.entityId, 64), from: str(sp.from, 10), to: str(sp.to, 10) };
  const page = Math.max(1, Number(sp.page) || 1);
  // Dates are the store's calendar days (IST).
  const createdAt: Prisma.DateTimeFilter = {
    ...(isDate(f.from) ? { gte: new Date(`${f.from}T00:00:00+05:30`) } : {}),
    ...(isDate(f.to) ? { lt: new Date(new Date(`${f.to}T00:00:00+05:30`).getTime() + 86400_000) } : {}),
  };
  const where: Prisma.AuditLogWhereInput = {
    ...(f.actor ? { actorEmail: f.actor } : {}),
    ...(f.action ? { action: f.action } : {}),
    ...(f.entity ? { entityType: f.entity } : {}),
    ...(f.entityId ? { entityId: f.entityId } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };
  const [rows, total, actors, actions, entities] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ["actorEmail"], orderBy: { actorEmail: "asc" } }),
    db.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
    db.auditLog.groupBy({ by: ["entityType"], orderBy: { entityType: "asc" } }),
  ]);
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams(Object.entries({ ...f, ...extra }).filter(([, v]) => v !== "").map(([k, v]) => [k, String(v)]));
    return `/admin/activity?${p}`;
  };
  const filtered = Object.values(f).some(Boolean);
  return (
    <AdminPage title="Activity" description={`Who changed what in the admin and the catalogue tools. ${total.toLocaleString("en-IN")} ${filtered ? "matching " : ""}entries. Kept for at least a year.`}>
      <form action="/admin/activity" className="grid gap-3 rounded-2xl border border-ink-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-sm font-medium text-ink-700">Person
          <select name="actor" defaultValue={f.actor} className={field}>
            <option value="">Everyone</option>
            {actors.map((a) => <option key={a.actorEmail} value={a.actorEmail}>{a.actorEmail}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-ink-700">Action
          <select name="action" defaultValue={f.action} className={field}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a.action} value={a.action}>{a.action}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-ink-700">Entity
          <select name="entity" defaultValue={f.entity} className={field}>
            <option value="">All</option>
            {entities.map((e) => <option key={e.entityType} value={e.entityType}>{e.entityType}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-ink-700">From<input type="date" name="from" defaultValue={f.from} className={field} /></label>
        <label className="text-sm font-medium text-ink-700">To<input type="date" name="to" defaultValue={f.to} className={field} /></label>
        <div className="flex items-end gap-2">
          {f.entityId && <input type="hidden" name="entityId" value={f.entityId} />}
          <button className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white">Filter</button>
          {filtered && <Link href="/admin/activity" className="h-10 content-center px-2 text-sm font-semibold text-brand-700">Clear</Link>}
        </div>
      </form>
      {f.entityId && <p className="text-sm text-ink-700">Showing one {f.entity || "item"} only. <Link href={qs({ entityId: "", page: "" })} className="font-semibold text-brand-700">Show all</Link></p>}
      <Table>
        <thead>
          <tr><th className={th}>When</th><th className={th}>Who</th><th className={th}>What changed</th><th className={th}>Item</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = auditEntityHref(r.entityType, r.entityId);
            return (
              <tr key={r.id}>
                <td className={`${td} whitespace-nowrap`}>{r.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                <td className={td}>{r.actorEmail}{r.ip && <span className="block text-xs text-ink-500">{r.ip}</span>}</td>
                <td className={td}>
                  <span className="font-mono text-xs text-ink-500">{r.action}</span>
                  <p>{r.summary}</p>
                  <AuditChangesList changes={r.changes} />
                </td>
                <td className={td}>
                  {href ? <Link href={href} className="font-semibold text-brand-700 hover:underline">Open {r.entityType.replace("_", " ")}</Link> : r.entityType}
                  {r.entityId && <Link href={qs({ entity: r.entityType, entityId: r.entityId, page: "" })} className="block text-xs text-ink-500 hover:underline">All changes to this</Link>}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td className={td} colSpan={4}>No activity matches these filters.</td></tr>}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(n) => qs({ page: n })} />
    </AdminPage>
  );
}
