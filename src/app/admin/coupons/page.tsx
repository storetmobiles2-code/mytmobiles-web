import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { saveCoupon } from "@/app/admin/actions/store";
import { AdminPage, Panel, Table, td, th } from "@/components/admin/ui";
import { ActionForm, Field, inputCls } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Coupons" };

type CouponRow = Awaited<ReturnType<typeof db.coupon.findMany>>[number];
const d = (x: Date | null) => (x ? x.toISOString().slice(0, 16) : "");

function CouponFields({ c, categories, brands }: { c?: CouponRow; categories: { id: string; name: string }[]; brands: { id: string; name: string }[] }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Code"><input name="code" required defaultValue={c?.code} className={`${inputCls} uppercase`} /></Field>
        <Field label="Type"><select name="type" defaultValue={c?.type ?? "PERCENT"} className={inputCls}><option value="PERCENT">% off</option><option value="FLAT">₹ off</option></select></Field>
        <Field label="Value" hint="Percent, or rupees for flat"><input name="value" required inputMode="decimal" defaultValue={c ? (c.type === "PERCENT" ? c.value : c.value / 100) : ""} className={inputCls} /></Field>
        <Field label="Max discount (₹)" hint="For % coupons"><input name="maxDiscount" inputMode="decimal" defaultValue={c?.maxDiscount ? c.maxDiscount / 100 : ""} className={inputCls} /></Field>
        <Field label="Min. order (₹)"><input name="minOrderValue" inputMode="decimal" defaultValue={c ? c.minOrderValue / 100 : ""} className={inputCls} /></Field>
        <Field label="Uses per customer"><input name="perUserLimit" type="number" min={1} defaultValue={c?.perUserLimit ?? 1} className={inputCls} /></Field>
        <Field label="Total usage limit" hint="Blank = unlimited"><input name="usageLimit" type="number" min={1} defaultValue={c?.usageLimit ?? ""} className={inputCls} /></Field>
        <Field label="Starts"><input name="startsAt" type="datetime-local" defaultValue={d(c?.startsAt ?? null)} className={inputCls} /></Field>
        <Field label="Ends"><input name="endsAt" type="datetime-local" defaultValue={d(c?.endsAt ?? null)} className={inputCls} /></Field>
      </div>
      <Field label="Description (shown to customers)"><input name="description" required defaultValue={c?.description} className={inputCls} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Only for categories" hint="None selected = all"><select name="categoryIds" multiple defaultValue={c?.applicableCategoryIds} className="mt-1 h-28 w-full rounded-xl border border-ink-300 p-2 text-sm">{categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Only for brands" hint="None selected = all"><select name="brandIds" multiple defaultValue={c?.applicableBrandIds} className="mt-1 h-28 w-full rounded-xl border border-ink-300 p-2 text-sm">{brands.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} className="h-4 w-4 accent-brand-600" /> Active</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isPublic" defaultChecked={c?.isPublic ?? true} className="h-4 w-4 accent-brand-600" /> Show on Offers page</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="firstOrderOnly" defaultChecked={c?.firstOrderOnly} className="h-4 w-4 accent-brand-600" /> First order only</label>
      </div>
    </>
  );
}

export default async function CouponsPage() {
  const [coupons, categories, brands] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <AdminPage title="Coupons" description="Discount codes customers apply in the cart. Discounts reduce the taxable value on the GST invoice.">
      <Panel title="New coupon"><ActionForm action={saveCoupon} submitLabel="Create coupon"><CouponFields categories={categories} brands={brands} /></ActionForm></Panel>
      <Table>
        <thead><tr><th className={th}>Code</th><th className={th}>Offer</th><th className={th}>Validity</th><th className={th}>Used</th><th className={th}>Status</th></tr></thead>
        <tbody>
          {coupons.map((c) => (
            <tr key={c.id}>
              <td className={td} colSpan={5}>
                <details>
                  <summary className="grid cursor-pointer grid-cols-5 items-center gap-2">
                    <span className="font-mono font-bold">{c.code}</span>
                    <span>{c.type === "PERCENT" ? `${c.value}%` : formatINR(c.value)} off{c.minOrderValue ? ` · min ${formatINR(c.minOrderValue)}` : ""}</span>
                    <span className="text-xs">{c.startsAt?.toLocaleDateString("en-IN") ?? "—"} → {c.endsAt?.toLocaleDateString("en-IN") ?? "no end"}</span>
                    <span>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</span>
                    <span>{c.isActive ? <Badge tone="success">Active</Badge> : <Badge>Off</Badge>}</span>
                  </summary>
                  <div className="mt-3 border-t border-ink-100 pt-3"><ActionForm action={saveCoupon}><CouponFields c={c} categories={categories} brands={brands} /></ActionForm></div>
                </details>
              </td>
            </tr>
          ))}
          {coupons.length === 0 && <tr><td className={td} colSpan={5}>No coupons yet.</td></tr>}
        </tbody>
      </Table>
    </AdminPage>
  );
}
