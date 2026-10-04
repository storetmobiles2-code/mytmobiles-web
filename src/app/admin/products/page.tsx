import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { AdminPage, FilterTabs, Table, td, th } from "@/components/admin/ui";
import { ActiveToggle } from "@/components/admin/product-forms";
import { Badge, Pagination } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Products" };
const PER = 40;

export default async function AdminProducts(props: PageProps<"/admin/products">) {
  const sp = await props.searchParams;
  const filter = typeof sp.filter === "string" ? sp.filter : "live";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const filters: Record<string, Prisma.ProductWhereInput> = {
    live: { isActive: true },
    hidden: { isActive: false },
    "hidden-in-stock": { isActive: false, inStock: true },
    "no-images": { isActive: true, images: { none: {} } },
    "out-of-stock": { isActive: true, inStock: false },
    demo: { condition: "DEMO" },
    all: {},
  };
  const where: Prisma.ProductWhereInput = {
    ...(filters[filter] ?? filters.live),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { variants: { some: { sku: { contains: q, mode: "insensitive" } } } }, { variants: { some: { externalNames: { has: q.toUpperCase() } } } }] } : {}),
  };
  const [products, total, counts] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ inStock: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * PER,
      take: PER,
      select: { id: true, name: true, slug: true, isActive: true, condition: true, priceFrom: true, inStock: true, category: { select: { name: true } }, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } }, variants: { select: { stock: true } } },
    }),
    db.product.count({ where }),
    Promise.all(Object.entries(filters).map(async ([k, w]) => [k, await db.product.count({ where: w })] as const)),
  ]);
  const count = Object.fromEntries(counts);
  const tabs = [
    ["live", "Live"], ["hidden-in-stock", "Hidden but in stock"], ["no-images", "Live without images"], ["out-of-stock", "Live, sold out"], ["demo", "Demo units"], ["hidden", "Hidden"], ["all", "All"],
  ].map(([key, label]) => ({ key, label, count: count[key], href: `/admin/products?filter=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}` }));
  return (
    <AdminPage title="Products" description={`${total} products`} actions={<ButtonLink href="/admin/products/new">New product</ButtonLink>}>
      <form className="flex gap-2" action="/admin/products">
        <input type="hidden" name="filter" value={filter} />
        <input name="q" defaultValue={q} placeholder="Search name, SKU or stock-sheet name" className="h-10 w-full max-w-md rounded-xl border border-ink-300 px-3 text-sm" />
        <button className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white">Search</button>
      </form>
      <FilterTabs items={tabs} active={filter} />
      <Table>
        <thead><tr><th className={th}>Product</th><th className={th}>Category</th><th className={th}>From</th><th className={th}>Stock</th><th className={th}>Status</th></tr></thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="hover:bg-ink-50">
              <td className={td}>
                <div className="flex items-center gap-3">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-ink-100">{p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="44px" className="object-contain" />}</div>
                  <div><Link href={`/admin/products/${p.id}`} className="font-semibold text-ink-900 hover:text-brand-700">{p.name}</Link>{p.condition === "DEMO" && <Badge tone="info" className="ml-2">Demo</Badge>}<span className="block text-xs text-ink-500">/p/{p.slug}</span></div>
                </div>
              </td>
              <td className={td}>{p.category.name}</td>
              <td className={td}>{formatINR(p.priceFrom)}</td>
              <td className={td}>{p.variants.reduce((s, v) => s + v.stock, 0)} <span className="text-xs text-ink-500">({p.variants.length} variants)</span></td>
              <td className={td}><ActiveToggle productId={p.id} active={p.isActive} /></td>
            </tr>
          ))}
          {products.length === 0 && <tr><td className={td} colSpan={5}>No products.</td></tr>}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(n) => `/admin/products?filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${n}`} />
    </AdminPage>
  );
}
