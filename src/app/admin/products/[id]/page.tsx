import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ImageManager, ProductForm, SpinManager, VariantTable } from "@/components/admin/product-forms";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { AuditHistory } from "@/components/admin/audit-history";

export const metadata = { title: "Edit product" };

type SpecGroup = { group: string; items: { label: string; value: string }[] };

export default async function EditProduct(props: PageProps<"/admin/products/[id]">) {
  const viewer = await requirePermission("products.view");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const [product, brands, categories] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { variants: { orderBy: [{ sortOrder: "asc" }, { price: "asc" }] }, images: { orderBy: { sortOrder: "asc" } }, spins: { orderBy: { createdAt: "asc" } } } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, hsnCode: true } }),
  ]);
  if (!product) notFound();
  const specsText = ((product.specs as unknown as SpecGroup[]) ?? []).map((g) => [`## ${g.group}`, ...g.items.map((i) => `${i.label}: ${i.value}`)].join("\n")).join("\n\n");
  const canEdit = hasPermission(viewer.role, "products.edit");
  const colors = [...new Set(product.variants.map((v) => v.color).filter(Boolean))] as string[];
  return (
    <AdminPage title={product.name} description={<>{product.isActive ? "Live" : "Hidden"} · <Link href={`/p/${product.slug}`} target="_blank" className="underline">View in store ↗</Link></>}>
      {sp.created && <p className="rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700">Product created. Add variants and images, then make it visible.</p>}
      {!canEdit && <p role="status" className="rounded-xl bg-ink-100 px-4 py-3 text-sm text-ink-700">View only. Your role can see products but not change prices, stock, images or details.</p>}
      {/* A disabled fieldset turns every control below read-only for roles without products.edit. */}
      <fieldset disabled={!canEdit} className="min-w-0 space-y-5">
        <legend className="sr-only">{canEdit ? "Edit product" : "Product (view only)"}</legend>
        <Panel title="Variants, prices & stock"><VariantTable productId={product.id} variants={product.variants} /></Panel>
        <Panel title="Images"><ImageManager productId={product.id} images={product.images} colors={colors} /></Panel>
        <Panel title="360° view"><SpinManager productId={product.id} spins={product.spins} colors={colors} /></Panel>
        <Panel title="Details">
          <ProductForm values={{ ...product, specsText }} brands={brands} categories={categories} />
        </Panel>
      </fieldset>
      {hasPermission(viewer.role, "audit.view") && <AuditHistory entityType="product" entityId={product.id} />}
    </AdminPage>
  );
}
