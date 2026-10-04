import { db } from "@/lib/db";
import { saveBrand, saveCategory } from "@/app/admin/actions/store";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ActionForm, inputCls } from "@/components/admin/action-form";

export const metadata = { title: "Categories & brands" };

export default async function CategoriesPage() {
  const [categories, brands] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } }),
    db.brand.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } }),
  ]);
  return (
    <AdminPage title="Categories & brands">
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Categories">
          <ul className="space-y-2">
            {[...categories, null].map((c) => (
              <li key={c?.id ?? "new"} className="rounded-xl border border-ink-200 p-3">
                <ActionForm action={saveCategory} submitLabel={c ? "Save" : "Add category"} className="grid items-end gap-2 sm:grid-cols-[1fr_90px_80px_auto]">
                  {c && <input type="hidden" name="id" value={c.id} />}
                  <label className="text-xs text-ink-500">{c ? `/c/${c.slug} · ${c._count.products} products` : "New category"}<input name="name" required defaultValue={c?.name} placeholder="Name" className={inputCls} /></label>
                  <label className="text-xs text-ink-500">HSN<input name="hsnCode" defaultValue={c?.hsnCode ?? ""} className={inputCls} /></label>
                  <label className="text-xs text-ink-500">Order<input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className={inputCls} /></label>
                  <label className="flex items-center gap-1 pb-2 text-xs"><input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} className="accent-brand-600" /> Active</label>
                  <input type="hidden" name="description" value={c?.description ?? ""} />
                </ActionForm>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Brands">
          <ul className="space-y-2">
            {[...brands, null].map((b) => (
              <li key={b?.id ?? "new"} className="rounded-xl border border-ink-200 p-3">
                <ActionForm action={saveBrand} submitLabel={b ? "Save" : "Add brand"} className="grid items-end gap-2 sm:grid-cols-[1fr_80px_auto]">
                  {b && <input type="hidden" name="id" value={b.id} />}
                  <label className="text-xs text-ink-500">{b ? `${b._count.products} products` : "New brand"}<input name="name" required defaultValue={b?.name} placeholder="Name" className={inputCls} /></label>
                  <label className="text-xs text-ink-500">Order<input name="sortOrder" type="number" defaultValue={b?.sortOrder ?? 0} className={inputCls} /></label>
                  <label className="flex items-center gap-1 pb-2 text-xs"><input type="checkbox" name="isActive" defaultChecked={b?.isActive ?? true} className="accent-brand-600" /> Active</label>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AdminPage>
  );
}
