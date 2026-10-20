import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { acknowledgeBy, ageLabel, formatIST, GRIEVANCE_CATEGORY_LABEL, GRIEVANCE_STATUS_LABEL, grievanceFlags, grievanceStatusTone, resolveBy } from "@/lib/grievances/rules";
import { AdminPage, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";
import { GrievanceUpdateForm } from "@/components/admin/grievance-admin-forms";

export const metadata = { title: "Grievance" };

export default async function AdminGrievanceDetail(props: PageProps<"/admin/grievances/[id]">) {
  const { id } = await props.params;
  const g = await db.grievance.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: "desc" } } } });
  if (!g) notFound();
  const actorIds = [...new Set(g.events.map((e) => e.actorId).filter((x): x is string => Boolean(x)))];
  const [actors, order] = await Promise.all([
    actorIds.length ? db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [],
    g.orderNumber ? db.order.findUnique({ where: { orderNumber: g.orderNumber }, select: { id: true, email: true } }) : null,
  ]);
  const actorName = (aid: string | null) => (aid ? (actors.find((a) => a.id === aid)?.name ?? "Staff") : null);
  const now = new Date();
  const f = grievanceFlags(g, now);

  return (
    <AdminPage
      title={`Complaint ${g.ticket}`}
      description={`Received ${formatIST(g.createdAt)} · ${ageLabel(g.createdAt, now)} ago`}
      actions={
        <>
          <Badge tone={grievanceStatusTone(g.status)}>{GRIEVANCE_STATUS_LABEL[g.status]}</Badge>
          {f.ackOverdue && <Badge tone="danger">Not acknowledged in 48 h</Badge>}
          {f.resolveOverdue && <Badge tone="danger">Past 1-month deadline</Badge>}
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Panel title="Complaint">
            <p className="text-xs font-bold text-ink-500 uppercase">{GRIEVANCE_CATEGORY_LABEL[g.category]}</p>
            <p className="mt-2 text-sm whitespace-pre-line">{g.message}</p>
            {g.resolution && (
              <div className="mt-4 rounded-xl bg-mint-50 p-3 text-sm">
                <p className="font-semibold text-mint-700">Resolution sent to the customer</p>
                <p className="mt-1 whitespace-pre-line">{g.resolution}</p>
              </div>
            )}
          </Panel>
          <Panel title="Update">
            <GrievanceUpdateForm grievanceId={g.id} status={g.status} />
          </Panel>
          <Panel title="History">
            <ol className="space-y-3 text-sm">
              {g.events.map((e) => (
                <li key={e.id} className="border-l-2 border-ink-200 pl-3">
                  <p className="whitespace-pre-line">{e.message} {!e.isPublic && <Badge>internal</Badge>}</p>
                  <p className="text-xs text-ink-500">{formatIST(e.createdAt)}{actorName(e.actorId) ? ` · ${actorName(e.actorId)}` : ""}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Deadlines">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-ink-500">Received</dt><dd>{formatIST(g.createdAt)}</dd>
              <dt className="text-ink-500">Acknowledge by</dt><dd className={f.ackOverdue ? "font-semibold text-danger-700" : undefined}>{formatIST(acknowledgeBy(g.createdAt))}</dd>
              <dt className="text-ink-500">Acknowledged</dt><dd>{g.acknowledgedAt ? formatIST(g.acknowledgedAt) : "Not yet"}</dd>
              <dt className="text-ink-500">Resolve by</dt><dd className={f.resolveOverdue ? "font-semibold text-danger-700" : undefined}>{formatIST(resolveBy(g.createdAt), false)}</dd>
              <dt className="text-ink-500">Resolved</dt><dd>{g.resolvedAt ? formatIST(g.resolvedAt) : "Not yet"}</dd>
            </dl>
            <p className="mt-3 text-xs text-ink-500">The first update the customer can see (a status change or a note) counts as the acknowledgement.</p>
          </Panel>
          <Panel title="Customer">
            <p className="text-sm font-semibold">{g.userId ? <Link href={`/admin/customers/${g.userId}`} className="text-brand-700 hover:underline">{g.name}</Link> : g.name}</p>
            <p className="text-sm"><a href={`mailto:${g.email}`} className="text-brand-700 hover:underline">{g.email}</a></p>
            {g.phone && <p className="text-sm"><a href={`tel:${g.phone}`} className="text-brand-700 hover:underline">{g.phone}</a></p>}
            {!g.userId && <p className="mt-1 text-xs text-ink-500">Filed without signing in.</p>}
            {g.orderNumber && (
              <p className="mt-3 text-sm">
                Order{" "}
                {order ? <Link href={`/admin/orders/${order.id}`} className="font-mono font-semibold text-brand-700 hover:underline">{g.orderNumber}</Link> : <span className="font-mono">{g.orderNumber}</span>}
                {!order && <span className="block text-xs text-amber-800">No order with this number.</span>}
                {order && order.email !== g.email && <span className="block text-xs text-amber-800">The order was placed with a different email ({order.email}).</span>}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
