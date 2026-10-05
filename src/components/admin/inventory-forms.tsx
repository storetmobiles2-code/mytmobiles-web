"use client";

import { useActionState, useState } from "react";
import { adjustStock, applyStockImportAction, previewStockImport, type ImportState } from "@/app/admin/actions/inventory";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError, FormSuccess } from "@/components/ui/field";

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

export function AdjustStockForm({ variantId, stock }: { variantId: string; stock: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(adjustStock, {});
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-brand-700">Adjust</button>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="variantId" value={variantId} />
      <select name="mode" className="h-8 rounded-lg border border-ink-300 px-1" aria-label="Mode"><option value="set">Set to</option><option value="add">Add (+/−)</option></select>
      <input name="quantity" type="number" defaultValue={stock} className="h-8 w-20 rounded-lg border border-ink-300 px-2" aria-label="Quantity" />
      <input name="reason" required placeholder="Reason (e.g. stock count, damaged)" className="h-8 w-48 rounded-lg border border-ink-300 px-2" aria-label="Reason" />
      <SubmitButton className="h-8 w-auto px-3 text-sm" pendingText="…">Save</SubmitButton>
      <button type="button" onClick={() => setOpen(false)} className="text-ink-500">Close</button>
      {state.error && <span className="text-danger-700">{state.error}</span>}
      {state.ok && <span className="text-mint-700">{state.ok}</span>}
    </form>
  );
}

export function StockImport() {
  const [preview, previewAction] = useActionState<ImportState, FormData>(previewStockImport, {});
  const [applied, applyAction] = useActionState<ImportState, FormData>(applyStockImportAction, {});
  const plan = preview.plan;
  if (applied.ok) return <FormSuccess message={applied.ok} />;
  return (
    <div className="space-y-4">
      <form action={previewAction} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Stock sheet CSV<input type="file" name="file" accept=".csv,text/csv" required className="mt-1 block text-sm" /></label>
        <SubmitButton className="w-auto" variant="outline" pendingText="Reading…">Preview changes</SubmitButton>
      </form>
      <p className="text-xs text-ink-500">Export your stock sheet as CSV with the columns <code>Name, Selling Price, Stock Quantity, Item Category Name</code>. Rows are matched to products by name. Units already sold online but not yet shipped are subtracted from the sheet quantity. Nothing changes until you confirm.</p>
      <FormError message={preview.error ?? applied.error} />
      {plan && (
        <div className="space-y-4 rounded-xl border border-ink-200 p-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <p><strong className="text-lg">{plan.updates.length}</strong><br />variants will change</p>
            <p><strong className="text-lg">{plan.unchanged}</strong><br />unchanged</p>
            <p><strong className="text-lg">{plan.unmatched.length}</strong><br />rows not matched</p>
            <p><strong className="text-lg">{plan.missingFromSheet}</strong><br />variants not in sheet (left as is)</p>
          </div>
          {(preview.parseErrors?.length ?? 0) > 0 && <p className="text-sm text-amber-800">{preview.parseErrors!.length} rows skipped: {preview.parseErrors!.slice(0, 3).map((e) => `line ${e.line}: ${e.message}`).join("; ")}</p>}
          {plan.updates.length > 0 && (
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="text-xs text-ink-500 uppercase"><th>Product / SKU</th><th className="text-right">Stock</th><th className="text-right">Price</th></tr></thead>
                <tbody>
                  {plan.updates.map((u) => (
                    <tr key={u.variantId} className="border-t border-ink-100">
                      <td className="py-1.5">{u.productName}<span className="block font-mono text-xs text-ink-500">{u.sku}{!u.productActive && " · hidden"}</span></td>
                      <td className="text-right">{u.stockBefore} → <strong>{u.stockAfter}</strong>{u.reserved > 0 && <span className="block text-xs text-ink-500">{u.reserved} held for unshipped orders</span>}</td>
                      <td className="text-right">{u.priceBefore === u.priceAfter ? inr(u.priceAfter) : <>{inr(u.priceBefore)} → <strong>{inr(u.priceAfter)}</strong></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {plan.newProducts.length > 0 && (
            <details className="text-sm"><summary className="cursor-pointer font-semibold">{plan.newProducts.length} new products from unmatched rows</summary>
              <ul className="mt-2 max-h-48 list-disc overflow-auto pl-5">{plan.newProducts.map((p) => <li key={p.name}>{p.name} — {p.variants} variants, {p.stock} in stock{p.existingProduct && " (adds variants to existing product)"}</li>)}</ul>
            </details>
          )}
          <form action={applyAction} className="space-y-3">
            <input type="hidden" name="csv" value={preview.csv} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="activateRestocked" defaultChecked className="h-4 w-4 accent-brand-600" /> Publish hidden products that come back in stock (only those with photos and manufacturer / country-of-origin details)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="createUnmatched" defaultChecked={plan.newProducts.length > 0} className="h-4 w-4 accent-brand-600" /> Create new products for unmatched rows (created hidden, for review)</label>
            <SubmitButton className="w-auto" pendingText="Applying…">Apply import</SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
