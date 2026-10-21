import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { addStaffMember, changeStaffRole, resendStaffInvite, setStaffDisabled } from "@/app/admin/actions/staff";
import { AdminPage, Panel, Table, td, th } from "@/components/admin/ui";
import { ActionButton, ActionForm, Field, inputCls } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Staff" };

const btn = "rounded-lg border border-ink-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink-900 hover:bg-ink-50";

export default async function StaffPage() {
  const me = await requirePermission("staff.manage");
  const people = await db.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true, isDisabled: true, lastLoginAt: true, createdAt: true },
  });
  const activeAdmins = people.filter((p) => p.role === "ADMIN" && !p.isDisabled).length;
  return (
    <AdminPage title="Staff" description="People who can sign in to this admin. Admins (owners) can do everything. Staff can handle orders, packing, invoices and reviews, and can view products and stock, but can't change prices, stock, settings or money.">
      <Panel title="Add a staff member">
        <ActionForm action={addStaffMember} submitLabel="Add" className="grid items-end gap-3 sm:grid-cols-[2fr_1.5fr_1fr_auto]">
          <Field label="Email"><input name="email" type="email" required autoComplete="off" className={inputCls} /></Field>
          <Field label="Name" hint="For new accounts"><input name="name" maxLength={80} autoComplete="off" className={inputCls} /></Field>
          <Field label="Role">
            <select name="role" defaultValue="STAFF" className={inputCls}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin (owner)</option>
            </select>
          </Field>
        </ActionForm>
        <p className="mt-3 text-xs text-ink-500">If the email already has a customer account, it gets the new role. Otherwise we create the account and email a link to set a password, valid for 3 days.</p>
      </Panel>
      <Table>
        <thead>
          <tr><th className={th}>Person</th><th className={th}>Role</th><th className={th}>Status</th><th className={th}>Last sign-in</th><th className={th}>Actions</th></tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const self = p.id === me.id;
            const lastAdmin = p.role === "ADMIN" && !p.isDisabled && activeAdmins <= 1;
            return (
              <tr key={p.id}>
                <td className={td}>
                  <Link href={`/admin/customers/${p.id}`} className="font-semibold text-brand-700 hover:underline">{p.name}</Link>
                  {self && <span className="ml-2 text-xs text-ink-500">(you)</span>}
                  <span className="block text-xs text-ink-500">{p.email}</span>
                </td>
                <td className={td}><Badge tone={p.role === "ADMIN" ? "brand" : "info"}>{ROLE_LABEL[p.role]}</Badge></td>
                <td className={td}>{p.isDisabled ? <Badge tone="danger">Disabled</Badge> : p.lastLoginAt ? <Badge tone="success">Active</Badge> : <Badge tone="warning">Invited</Badge>}</td>
                <td className={td}>{p.lastLoginAt ? p.lastLoginAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "Never"}</td>
                <td className={td}>
                  {self ? (
                    <span className="text-xs text-ink-500">You can&apos;t change your own access.</span>
                  ) : lastAdmin ? (
                    <span className="text-xs text-ink-500">Last active admin. Make someone else an admin first.</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {p.role === "STAFF" ? (
                        <ActionButton run={changeStaffRole.bind(null, p.id, "ADMIN")} confirmText={`Give ${p.email} full admin access, including prices, settings, refunds and staff?`} className={btn}>Make admin</ActionButton>
                      ) : (
                        <ActionButton run={changeStaffRole.bind(null, p.id, "STAFF")} confirmText={`Change ${p.email} to staff? They will lose access to prices, settings, refunds and staff.`} className={btn}>Make staff</ActionButton>
                      )}
                      <ActionButton run={changeStaffRole.bind(null, p.id, "CUSTOMER")} confirmText={`Remove admin access for ${p.email}? Their customer account stays.`} className={btn}>Remove access</ActionButton>
                      <ActionButton run={setStaffDisabled.bind(null, p.id, !p.isDisabled)} confirmText={p.isDisabled ? `Enable ${p.email}?` : `Disable ${p.email} and sign them out everywhere?`} className={btn}>{p.isDisabled ? "Enable" : "Disable"}</ActionButton>
                      {!p.lastLoginAt && !p.isDisabled && <ActionButton run={resendStaffInvite.bind(null, p.id)} className={btn}>Resend invite</ActionButton>}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </AdminPage>
  );
}
