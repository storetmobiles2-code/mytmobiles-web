import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { AdminPage, FilterTabs, Panel, Table, td, th } from "@/components/admin/ui";
import { AdjustStockForm, StockImport } from "@/components/admin/inventory-forms";
import { Pagination } from "@/components/ui/misc";

export const metadata = { title: "Inventory" };
const PER = 50;

export default async function InventoryPage(props: PageProps<"/admin/inventory">) {
  const sp = await props.searchParams;
  const filter = typeof sp.filter === "string" ? sp.filter : "live";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const base: Record<string, Prisma.ProductVariantWhereInput> = {
    live: { product: { isActive: true } },
    low: { product: { isActive: true }, isActive: true, stock: { lte: 2 } },
    "in-stock": { stock: { gt: 0 } },
    all: {},
  };
  const where: Prisma.ProductVariantWhereInput = { ...(base[filter] ?? base.live), ...(q ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { product: { name: { contains: q, mode: "insensitive" } } }] } : {}) };
  const [variants, total, logs] = await Promise.all([
    db.productVariant.findMany({ where, orderBy: [{ stock: "asc" }, { sku: "asc" }], skip: (page - 1) * PER, take: PER, include: { product: { select: { id: true, name: true, isActive: true } } } }),
    db.productVariant.count({ where }),
    db.inventoryLog.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { variant: { select: { sku: true } }, actor: { select: { name: true } } } }),
  ]);
  return (
    <AdminPage title="Inventory">
      <Panel title="Import stock sheet"><StockImport /></Panel>
      <form className="flex gap-2" action="/admin/inventory">
        <input type="hidden" name="filter" value={filter} />
        <input name="q" defaultValue={q} placeholder="Search SKU or product" className="h-10 w-full max-w-md rounded-xl border border-ink-300 px-3 text-sm" />
        <button className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white">Search</button>
      </form>
      <FilterTabs active={filter} items={[["live", "Live products"], ["low", "Low stock (≤ 2)"], ["in-stock", "In stock"], ["all", "All"]].map(([key, label]) => ({ key, label, href: `/admin/inventory?filter=${key}` }))} />
      <Table>
        <thead><tr><th className={th}>SKU</th><th className={th}>Product</th><th className={th}>Price</th><th className={th}>Stock</th><th className={th}>Adjust</th></tr></thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.id}>
              <td className={`${td} font-mono text-xs`}>{v.sku}</td>
              <td className={td}><Link href={`/admin/products/${v.product.id}`} className="hover:text-brand-700">{v.product.name}</Link>{!v.product.isActive && <span className="ml-1 text-xs text-ink-500">(hidden)</span>}<span className="block text-xs text-ink-500">{[v.ram, v.storage, v.color].filter(Boolean).join(" · ")}</span></td>
              <td className={td}>{formatINR(v.price)}</td>
              <td className={`${td} font-bold ${v.stock <= v.lowStockThreshold ? "text-danger-700" : ""}`}>{v.stock}</td>
              <td className={td}><AdjustStockForm variantId={v.id} stock={v.stock} /></td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(n) => `/admin/inventory?filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${n}`} />
      <Panel title="Recent stock movements">
        <ul className="divide-y divide-ink-100 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-2">
              <span><span className="font-mono text-xs">{l.variant.sku}</span> · {l.reason}{l.actor ? ` · ${l.actor.name}` : ""}</span>
              <span className={`font-semibold tabular-nums ${l.delta < 0 ? "text-danger-700" : "text-mint-700"}`}>{l.delta > 0 ? "+" : ""}{l.delta}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </AdminPage>
  );
}
