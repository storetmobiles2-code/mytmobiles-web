"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Facets } from "@/lib/catalog/queries";
import type { ListingFilters } from "@/lib/catalog/filters";
import { formatStorage, SORTS } from "@/lib/catalog/filters";
import { DEMO, demoNavigate } from "@/lib/demo";

function toQuery(form: HTMLFormElement): string {
  const fd = new FormData(form);
  const p = new URLSearchParams();
  const multi: Record<string, string[]> = {};
  for (const [k, v] of fd.entries()) {
    const val = String(v).trim();
    if (!val) continue;
    if (["brand", "ram", "storage"].includes(k)) (multi[k] ??= []).push(val);
    else p.set(k, val);
  }
  for (const [k, vals] of Object.entries(multi)) p.set(k, vals.join(","));
  if (p.get("sort") === "relevance") p.delete("sort");
  p.delete("page");
  return p.toString();
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-ink-100 py-4 last:border-0">
      <legend className="mb-2 text-xs font-bold tracking-wide text-ink-500 uppercase">{title}</legend>
      <div className="space-y-1.5">{children}</div>
    </fieldset>
  );
}

function Check({ name, value, checked, label }: { name: string; value: string; checked: boolean; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 text-sm text-ink-700 hover:bg-ink-50">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="h-4 w-4 rounded border-ink-300 accent-brand-600" />
      <span className="flex-1">{label}</span>
    </label>
  );
}

export function FiltersForm({ filters, facets, mode, showBrand = true, showCondition = true }: { filters: ListingFilters; facets: Facets; mode: "desktop" | "mobile"; showBrand?: boolean; showCondition?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const desktop = useRef<HTMLFormElement>(null);
  const mobileDialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();

  const apply = (form: HTMLFormElement) => {
    if (DEMO) {
      demoNavigate(toQuery(form));
      mobileDialog.current?.close();
      return;
    }
    start(() => router.push(`${pathname}?${toQuery(form)}`, { scroll: false }));
  };

  const fields = (
    <>
      {filters.q && <input type="hidden" name="q" value={filters.q} />}
      <input type="hidden" name="sort" value={filters.sort} />
      {showBrand && facets.brands.length > 1 && (
        <Group title="Brand">
          {facets.brands.map((b) => (
            <Check key={b.slug} name="brand" value={b.slug} checked={filters.brands.includes(b.slug)} label={<>{b.name} <span className="text-ink-500">({b.count})</span></>} />
          ))}
        </Group>
      )}
      <Group title="Price (₹)">
        <div className="flex items-center gap-2">
          <input name="min" type="number" inputMode="numeric" min={0} placeholder={`Min ${facets.priceMin || ""}`} defaultValue={filters.minPrice ?? ""} aria-label="Minimum price" className="w-full rounded-lg border border-ink-300 px-2.5 py-1.5 text-sm" />
          <span className="text-ink-500">–</span>
          <input name="max" type="number" inputMode="numeric" min={0} placeholder={`Max ${facets.priceMax || ""}`} defaultValue={filters.maxPrice ?? ""} aria-label="Maximum price" className="w-full rounded-lg border border-ink-300 px-2.5 py-1.5 text-sm" />
        </div>
      </Group>
      {facets.ram.length > 1 && (
        <Group title="RAM">
          {facets.ram.map((r) => (
            <Check key={r} name="ram" value={String(r)} checked={filters.ram.includes(r)} label={`${r} GB`} />
          ))}
        </Group>
      )}
      {facets.storage.length > 1 && (
        <Group title="Storage">
          {facets.storage.map((s) => (
            <Check key={s} name="storage" value={String(s)} checked={filters.storage.includes(s)} label={formatStorage(s)} />
          ))}
        </Group>
      )}
      <Group title="Discount">
        {[10, 20, 30, 40].map((d) => (
          <label key={d} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 text-sm text-ink-700 hover:bg-ink-50">
            <input type="radio" name="discount" value={d} defaultChecked={filters.minDiscount === d} className="h-4 w-4 accent-brand-600" />
            {d}% or more
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 text-sm text-ink-700 hover:bg-ink-50">
          <input type="radio" name="discount" value="" defaultChecked={!filters.minDiscount} className="h-4 w-4 accent-brand-600" />
          Any
        </label>
      </Group>
      <Group title="More">
        <Check name="instock" value="1" checked={filters.inStock} label="In stock only" />
        <Check name="5g" value="1" checked={filters.only5G} label="5G phones" />
        {showCondition && facets.hasDemo && (
          <>
            <Check name="condition" value="new" checked={filters.condition === "new"} label="New only (hide demo units)" />
          </>
        )}
      </Group>
    </>
  );

  if (mode === "desktop") {
    return (
      // Desktop sidebar: applies instantly; plain GET form without JS.
      <form ref={desktop} action={pathname} method="get" onChange={(e) => apply(e.currentTarget)} onSubmit={(e) => { e.preventDefault(); apply(e.currentTarget); }} className={pending ? "opacity-60" : ""} aria-label="Filters">
        {fields}
        <noscript>
          <button className="mt-3 w-full rounded-xl bg-brand-600 py-2 font-semibold text-white">Apply filters</button>
        </noscript>
      </form>
    );
  }

  return (
    <>
      {/* Mobile: full-screen sheet */}
      <button type="button" onClick={() => mobileDialog.current?.showModal()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-300 bg-white px-3 text-sm font-semibold lg:hidden">
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters
      </button>
      <dialog ref={mobileDialog} className="m-0 mt-auto h-[85dvh] max-h-[85dvh] w-full max-w-none rounded-t-3xl bg-white p-0 backdrop:bg-ink-900/40" aria-label="Filters" onClick={(e) => e.target === mobileDialog.current && mobileDialog.current?.close()}>
        <form action={pathname} method="get" onSubmit={(e) => { e.preventDefault(); mobileDialog.current?.close(); apply(e.currentTarget); }} className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="font-bold">Filters</h2>
            <button type="button" onClick={() => mobileDialog.current?.close()} className="rounded-lg p-2 hover:bg-ink-100" aria-label="Close filters"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4">{fields}</div>
          <div className="flex gap-3 border-t border-ink-100 p-4">
            <a href={`${pathname}${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ""}`} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-ink-300 font-semibold">Clear all</a>
            <button className="h-11 flex-1 rounded-xl bg-brand-600 font-semibold text-white">Show results</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-500">
      <span className="hidden sm:inline">Sort by</span>
      <select
        value={value}
        onChange={(e) => {
          const p = new URLSearchParams(location.search);
          if (e.target.value === "relevance") p.delete("sort");
          else p.set("sort", e.target.value);
          p.delete("page");
          if (DEMO) demoNavigate(p.toString());
          else router.push(`${pathname}?${p.toString()}`, { scroll: false });
        }}
        className="h-10 rounded-xl border border-ink-300 bg-white px-3 text-sm font-semibold text-ink-900"
        aria-label="Sort products"
      >
        {Object.entries(SORTS).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
    </label>
  );
}
