"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { deleteImage, deleteVariant, saveProduct, saveVariant, setProductActive, updateImage, uploadProductImage, type AdminResult } from "@/app/admin/actions/products";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError, FormSuccess, SelectField, TextAreaField, TextField } from "@/components/ui/field";

type Opt = { id: string; name: string };

export interface ProductFormValues {
  id?: string;
  name?: string;
  slug?: string;
  brandId?: string;
  categoryId?: string;
  condition?: "NEW" | "DEMO";
  shortDescription?: string;
  description?: string;
  warranty?: string | null;
  hsnCode?: string;
  gstRateBps?: number;
  returnWindowDays?: number;
  manufacturerInfo?: string | null;
  countryOfOrigin?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  highlights?: string[];
  keywords?: string[];
  boxContents?: string[];
  specsText?: string;
  is5G?: boolean;
  isFeatured?: boolean;
  isActive?: boolean;
}

export function ProductForm({ values, brands, categories }: { values: ProductFormValues; brands: Opt[]; categories: (Opt & { hsnCode: string | null })[] }) {
  const [state, action] = useActionState<AdminResult, FormData>(saveProduct, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <FormSuccess message={state.ok} />
      <FormError message={state.error} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Product name" name="name" defaultValue={values.name} required error={fe.name} />
        <TextField label="URL slug" name="slug" defaultValue={values.slug} error={fe.slug} hint="Leave blank to generate from the name" />
        <SelectField label="Brand" name="brandId" defaultValue={values.brandId ?? ""} error={fe.brandId}>
          <option value="">Select…</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </SelectField>
        <SelectField label="Category" name="categoryId" defaultValue={values.categoryId ?? ""} error={fe.categoryId}>
          <option value="">Select…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <SelectField label="Condition" name="condition" defaultValue={values.condition ?? "NEW"}>
          <option value="NEW">Brand new</option>
          <option value="DEMO">Demo / open-box unit</option>
        </SelectField>
        <TextField label="Warranty" name="warranty" defaultValue={values.warranty ?? ""} optional />
      </div>
      <TextField label="Short description" name="shortDescription" defaultValue={values.shortDescription} required error={fe.shortDescription} hint="One sentence for listings and search results" />
      <TextAreaField label="Description" name="description" defaultValue={values.description} required error={fe.description} rows={5} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextAreaField label="Highlights (one per line)" name="highlights" defaultValue={values.highlights?.join("\n")} rows={4} optional />
        <TextAreaField label="In the box (one per line)" name="boxContents" defaultValue={values.boxContents?.join("\n")} rows={4} optional />
      </div>
      <TextAreaField label="Specifications" name="specs" defaultValue={values.specsText} rows={10} optional hint="Use '## Group' headings and 'Label: Value' lines. Only enter specs you've verified from the manufacturer." className="font-mono text-sm" />
      <div className="grid gap-4 md:grid-cols-4">
        <TextField label="HSN code" name="hsnCode" defaultValue={values.hsnCode} required error={fe.hsnCode} />
        <SelectField label="GST rate" name="gstRateBps" defaultValue={String(values.gstRateBps ?? 1800)}>
          {[0, 500, 1200, 1800, 2800].map((r) => <option key={r} value={r}>{r / 100}%</option>)}
        </SelectField>
        <TextField label="Return window (days)" name="returnWindowDays" type="number" min={0} max={30} defaultValue={values.returnWindowDays ?? 7} />
        <TextField label="Country of origin" name="countryOfOrigin" defaultValue={values.countryOfOrigin ?? ""} optional />
      </div>
      <TextField label="Manufacturer / importer / packer details" name="manufacturerInfo" defaultValue={values.manufacturerInfo ?? ""} optional hint="Required disclosure under Legal Metrology (Packaged Commodities) Rules" />
      <TextField label="Search keywords (comma separated)" name="keywords" defaultValue={values.keywords?.join(", ")} optional />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="SEO title" name="seoTitle" defaultValue={values.seoTitle ?? ""} optional maxLength={70} />
        <TextField label="SEO description" name="seoDescription" defaultValue={values.seoDescription ?? ""} optional maxLength={170} />
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={values.isActive} className="h-4 w-4 accent-brand-600" /> Visible in store</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isFeatured" defaultChecked={values.isFeatured} className="h-4 w-4 accent-brand-600" /> Featured</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="is5G" defaultChecked={values.is5G} className="h-4 w-4 accent-brand-600" /> 5G</label>
      </div>
      <SubmitButton className="w-full sm:w-auto" pendingText="Saving…">{values.id ? "Save product" : "Create product"}</SubmitButton>
    </form>
  );
}

export function ActiveToggle({ productId, active }: { productId: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await setProductActive(productId, !active); setErr(r.error ?? null); router.refresh(); })} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${active ? "bg-mint-50 text-mint-700" : "bg-ink-100 text-ink-500"}`}>
        {active ? "Live" : "Hidden"}
      </button>
      {err && <span className="text-xs text-danger-700">{err}</span>}
    </span>
  );
}

export interface VariantRow {
  id: string;
  sku: string;
  color: string | null;
  colorHex: string | null;
  ramGb: number | null;
  storageGb: number | null;
  price: number;
  mrp: number;
  stock: number;
  maxPerOrder: number;
  lowStockThreshold: number;
  isActive: boolean;
  externalNames: string[];
}

export function VariantEditor({ productId, variant, onDone }: { productId: string; variant?: VariantRow; onDone?: () => void }) {
  const router = useRouter();
  const [state, action] = useActionState<AdminResult, FormData>(async (prev, fd) => {
    const r = await saveVariant(prev, fd);
    if (r.ok) {
      router.refresh();
      onDone?.();
    }
    return r;
  }, {});
  const input = "h-9 w-full rounded-lg border border-ink-300 px-2 text-sm";
  return (
    <form action={action} className="grid gap-2 rounded-xl border border-ink-200 bg-ink-50 p-3 text-sm sm:grid-cols-4 lg:grid-cols-6">
      <input type="hidden" name="productId" value={productId} />
      {variant && <input type="hidden" name="id" value={variant.id} />}
      <label>SKU<input name="sku" required defaultValue={variant?.sku} className={input} /></label>
      <label>Colour<input name="color" defaultValue={variant?.color ?? ""} className={input} /></label>
      <label>Colour hex<input name="colorHex" placeholder="#000000" defaultValue={variant?.colorHex ?? ""} className={input} /></label>
      <label>RAM (GB)<input name="ramGb" type="number" defaultValue={variant?.ramGb ?? ""} className={input} /></label>
      <label>Storage (GB)<input name="storageGb" type="number" defaultValue={variant?.storageGb ?? ""} className={input} /></label>
      <label>Price (₹)<input name="price" required inputMode="decimal" defaultValue={variant ? variant.price / 100 : ""} className={input} /></label>
      <label>MRP (₹)<input name="mrp" inputMode="decimal" defaultValue={variant ? variant.mrp / 100 : ""} className={input} /></label>
      {!variant && <label>Opening stock<input name="stock" type="number" min={0} defaultValue={0} className={input} /></label>}
      <label>Max per order<input name="maxPerOrder" type="number" min={1} max={10} defaultValue={variant?.maxPerOrder ?? 3} className={input} /></label>
      <label>Low-stock alert at<input name="lowStockThreshold" type="number" min={0} defaultValue={variant?.lowStockThreshold ?? 2} className={input} /></label>
      <label className="sm:col-span-2">Stock-sheet names (one per line)<textarea name="externalNames" defaultValue={variant?.externalNames.join("\n")} className="h-16 w-full rounded-lg border border-ink-300 p-2 text-xs" /></label>
      <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" name="isActive" defaultChecked={variant?.isActive ?? true} className="h-4 w-4 accent-brand-600" /> Active</label>
      <div className="flex items-end gap-2 sm:col-span-4 lg:col-span-6">
        <SubmitButton className="h-9" pendingText="Saving…">{variant ? "Save variant" : "Add variant"}</SubmitButton>
        {onDone && <button type="button" onClick={onDone} className="h-9 rounded-lg px-3 font-semibold text-ink-700 hover:bg-ink-200">Cancel</button>}
        {state.error && <p className="text-danger-700" role="alert">{state.error}</p>}
        {state.ok && <p className="text-mint-700" role="status">{state.ok}</p>}
      </div>
    </form>
  );
}

export function VariantTable({ productId, variants }: { productId: string; variants: VariantRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead><tr className="text-xs text-ink-500 uppercase"><th className="py-2">SKU</th><th>Variant</th><th className="text-right">Price</th><th className="text-right">MRP</th><th className="text-right">Stock</th><th>Status</th><th /></tr></thead>
          <tbody>
            {variants.map((v) =>
              editing === v.id ? (
                <tr key={v.id}><td colSpan={7} className="py-2"><VariantEditor productId={productId} variant={v} onDone={() => setEditing(null)} /></td></tr>
              ) : (
                <tr key={v.id} className="border-t border-ink-100">
                  <td className="py-2 font-mono text-xs">{v.sku}</td>
                  <td>{[v.ramGb && `${v.ramGb} GB`, v.storageGb && `${v.storageGb} GB`, v.color].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="text-right">{inr(v.price)}</td>
                  <td className="text-right text-ink-500">{inr(v.mrp)}</td>
                  <td className={`text-right font-semibold ${v.stock <= v.lowStockThreshold ? "text-danger-700" : ""}`}>{v.stock}</td>
                  <td>{v.isActive ? "Active" : <span className="text-ink-500">Inactive</span>}</td>
                  <td className="text-right whitespace-nowrap">
                    <button type="button" onClick={() => setEditing(v.id)} className="mr-3 font-semibold text-brand-700">Edit</button>
                    <button type="button" disabled={pending} onClick={() => { if (confirm("Delete this variant?")) start(async () => { const r = await deleteVariant(v.id); setMsg(r.ok ?? r.error ?? null); router.refresh(); }); }} className="font-semibold text-danger-700">Delete</button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {msg && <p className="text-sm text-ink-700" role="status">{msg}</p>}
      {editing === "new" ? <VariantEditor productId={productId} onDone={() => setEditing(null)} /> : <button type="button" onClick={() => setEditing("new")} className="text-sm font-semibold text-brand-700">+ Add variant</button>}
      <p className="text-xs text-ink-500">Stock is changed from <a href="/admin/inventory" className="underline">Inventory</a> (adjustments are logged), or by importing the stock sheet.</p>
    </div>
  );
}

export interface ImageRow {
  id: string;
  url: string;
  alt: string;
  color: string | null;
  credit: string | null;
  sourceUrl: string | null;
  license: string | null;
}

export function ImageManager({ productId, images, colors }: { productId: string; images: ImageRow[]; colors: string[] }) {
  const router = useRouter();
  const [state, action] = useActionState<AdminResult, FormData>(async (p, fd) => {
    const r = await uploadProductImage(p, fd);
    if (r.ok) router.refresh();
    return r;
  }, {});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <li key={img.id} className={`rounded-xl border border-ink-200 p-2 text-xs ${pending ? "opacity-60" : ""}`}>
            <div className="relative aspect-square overflow-hidden rounded-lg bg-white"><Image src={img.url} alt={img.alt} fill sizes="200px" className="object-contain" /></div>
            <select defaultValue={img.color ?? ""} onChange={(e) => run(() => updateImage(img.id, { color: e.target.value || null }))} className="mt-2 h-8 w-full rounded-lg border border-ink-300 px-1" aria-label="Image colour">
              <option value="">All colours</option>
              {colors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input defaultValue={img.alt} onBlur={(e) => e.target.value !== img.alt && run(() => updateImage(img.id, { alt: e.target.value }))} className="mt-1 h-8 w-full rounded-lg border border-ink-300 px-2" aria-label="Alt text" />
            {(img.credit || img.sourceUrl) && <p className="mt-1 truncate text-ink-500" title={img.license ?? ""}>{img.credit}{img.sourceUrl && <> · <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">source</a></>}</p>}
            <div className="mt-1 flex justify-between">
              <span className="flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => run(() => updateImage(img.id, { move: -1 }))} className="rounded p-1 hover:bg-ink-100 disabled:opacity-30" aria-label="Move earlier"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" disabled={i === images.length - 1} onClick={() => run(() => updateImage(img.id, { move: 1 }))} className="rounded p-1 hover:bg-ink-100 disabled:opacity-30" aria-label="Move later"><ArrowDown className="h-4 w-4" /></button>
              </span>
              <button type="button" onClick={() => { if (confirm("Remove this image?")) run(() => deleteImage(img.id)); }} className="rounded p-1 text-danger-700 hover:bg-danger-50" aria-label="Delete image"><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
        {images.length === 0 && <li className="col-span-full text-sm text-ink-500">No images — the store shows a “Photo coming soon” placeholder.</li>}
      </ul>
      <form action={action} className="grid gap-2 rounded-xl border border-dashed border-ink-300 p-4 text-sm sm:grid-cols-2">
        <input type="hidden" name="productId" value={productId} />
        <label className="sm:col-span-2">Upload images (JPEG/PNG/WebP, ≤ 8 MB each)<input type="file" name="files" accept="image/jpeg,image/png,image/webp,image/avif" multiple required className="mt-1 block w-full text-sm" /></label>
        <label>Colour<select name="color" className="mt-1 h-9 w-full rounded-lg border border-ink-300 px-2"><option value="">All colours</option>{colors.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Credit (e.g. © Samsung)<input name="credit" className="mt-1 h-9 w-full rounded-lg border border-ink-300 px-2" /></label>
        <label>Source URL<input name="sourceUrl" type="url" className="mt-1 h-9 w-full rounded-lg border border-ink-300 px-2" /></label>
        <label>Licence / usage note<input name="license" className="mt-1 h-9 w-full rounded-lg border border-ink-300 px-2" /></label>
        <p className="text-xs text-ink-500 sm:col-span-2">Use only images you&apos;re allowed to use (official brand assets under your reseller terms, or your own photos), and only for the exact model and colour.</p>
        <div className="flex items-center gap-3 sm:col-span-2">
          <SubmitButton className="h-9 w-auto" pendingText="Uploading…">Upload</SubmitButton>
          {state.error && <span className="text-danger-700" role="alert">{state.error}</span>}
          {state.ok && <span className="text-mint-700" role="status">{state.ok}</span>}
        </div>
      </form>
    </div>
  );
}
