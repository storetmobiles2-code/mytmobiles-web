import Image from "next/image";
import { db } from "@/lib/db";
import { deleteBanner, saveBanner } from "@/app/admin/actions/store";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ActionButton, ActionForm, Field, inputCls } from "@/components/admin/action-form";

export const metadata = { title: "Banners" };
type B = Awaited<ReturnType<typeof db.banner.findMany>>[number];
const d = (x: Date | null) => (x ? x.toISOString().slice(0, 16) : "");

function BannerFields({ b }: { b?: B }) {
  return (
    <>
      {b && <input type="hidden" name="id" value={b.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Eyebrow"><input name="eyebrow" defaultValue={b?.eyebrow ?? ""} className={inputCls} /></Field>
        <Field label="Title"><input name="title" required defaultValue={b?.title} className={inputCls} /></Field>
        <Field label="Subtitle"><input name="subtitle" defaultValue={b?.subtitle ?? ""} className={inputCls} /></Field>
        <Field label="Link (site path)"><input name="href" required defaultValue={b?.href ?? "/"} className={inputCls} /></Field>
        <Field label="Button label"><input name="ctaLabel" required defaultValue={b?.ctaLabel ?? "Shop now"} className={inputCls} /></Field>
        <Field label="Image URL" hint="A product image path (e.g. /images/products/…) or upload below"><input name="imageUrl" defaultValue={b?.imageUrl ?? ""} className={inputCls} /></Field>
        <Field label="Upload image"><input type="file" name="image" accept="image/*" className="mt-1 block text-sm" /></Field>
        <Field label="Image alt text"><input name="imageAlt" defaultValue={b?.imageAlt ?? ""} className={inputCls} /></Field>
        <Field label="Gradient from"><input name="bgFrom" type="color" defaultValue={b?.bgFrom ?? "#000000"} className="mt-1 h-10 w-full rounded-xl border border-ink-300" /></Field>
        <Field label="Gradient to"><input name="bgTo" type="color" defaultValue={b?.bgTo ?? "#5e0a31"} className="mt-1 h-10 w-full rounded-xl border border-ink-300" /></Field>
        <Field label="Text colour"><select name="textTone" defaultValue={b?.textTone ?? "light"} className={inputCls}><option value="light">Light (on dark)</option><option value="dark">Dark (on light)</option></select></Field>
        <Field label="Order"><input name="sortOrder" type="number" min={0} defaultValue={b?.sortOrder ?? 0} className={inputCls} /></Field>
        <Field label="Starts"><input name="startsAt" type="datetime-local" defaultValue={d(b?.startsAt ?? null)} className={inputCls} /></Field>
        <Field label="Ends"><input name="endsAt" type="datetime-local" defaultValue={d(b?.endsAt ?? null)} className={inputCls} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={b?.isActive ?? true} className="h-4 w-4 accent-brand-600" /> Active</label>
    </>
  );
}

export default async function BannersPage() {
  const banners = await db.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }] });
  return (
    <AdminPage title="Homepage banners">
      {banners.map((b) => (
        <Panel key={b.id} title={b.title} actions={<ActionButton run={deleteBanner.bind(null, b.id)} confirmText="Delete this banner?" className="text-sm font-semibold text-danger-700">Delete</ActionButton>}>
          <div className="mb-4 flex items-center gap-4 rounded-xl p-4 text-white" style={{ background: `linear-gradient(120deg, ${b.bgFrom}, ${b.bgTo})` }}>
            {b.imageUrl && <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-white"><Image src={b.imageUrl} alt="" fill sizes="64px" className="object-contain" /></div>}
            <div><p className="text-xs uppercase opacity-70">{b.eyebrow}</p><p className="font-bold">{b.title}</p></div>
            {!b.isActive && <span className="ml-auto rounded bg-white/20 px-2 text-xs">inactive</span>}
          </div>
          <details><summary className="cursor-pointer text-sm font-semibold text-brand-700">Edit</summary><div className="mt-3"><ActionForm action={saveBanner}><BannerFields b={b} /></ActionForm></div></details>
        </Panel>
      ))}
      <Panel title="New banner"><ActionForm action={saveBanner} submitLabel="Create banner"><BannerFields /></ActionForm></Panel>
    </AdminPage>
  );
}
