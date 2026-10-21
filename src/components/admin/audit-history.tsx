import Link from "next/link";
import { db } from "@/lib/db";
import { formatAuditValue, type AuditChanges } from "@/lib/admin/audit-diff";
import { Panel } from "./ui";

const when = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/** "field: before → after" for each changed field. */
export function AuditChangesList({ changes }: { changes: unknown }) {
  if (!changes || typeof changes !== "object") return null;
  const entries = Object.entries(changes as AuditChanges);
  if (!entries.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs">
      {entries.map(([field, v]) => (
        <li key={field} className="break-words">
          <span className="font-mono text-ink-500">{field}</span>: <span className="text-ink-700 line-through decoration-ink-300">{formatAuditValue(field, v?.before)}</span> → <span className="font-semibold text-ink-900">{formatAuditValue(field, v?.after)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Recent audit entries for one order, product, etc. Render only for people with `audit.view`. */
export async function AuditHistory({ entityType, entityId, take = 15 }: { entityType: string; entityId: string; take?: number }) {
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" }, take }),
    db.auditLog.count({ where: { entityType, entityId } }),
  ]);
  return (
    <Panel title="History" actions={total > take ? <Link href={`/admin/activity?entity=${entityType}&entityId=${entityId}`} className="text-sm font-semibold text-brand-700">All {total} changes</Link> : undefined}>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-500">No admin changes recorded yet.</p>
      ) : (
        <ol className="space-y-3 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="border-l-2 border-ink-200 pl-3">
              <p>{r.summary}</p>
              <AuditChangesList changes={r.changes} />
              <p className="mt-0.5 text-xs text-ink-500">
                {when(r.createdAt)} · {r.actorEmail} · <span className="font-mono">{r.action}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
