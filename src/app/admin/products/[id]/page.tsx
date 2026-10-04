import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ImageManager, ProductForm, VariantTable } from "@/components/admin/product-forms";

export const metadata = { title: "Edit product" };

type SpecGroup = { group: string; items: { label: string; value: string }[] };

export default async function EditProduct(props: PageProps<"/admin/products/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const [product, brands, categories] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { variants: { orderBy: [{ sortOrder: "asc" }, { price: "asc" }] }, images: { orderBy: { sortOrder: "asc" } } } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, hsnCode: true } }),
  ]);
  if (!product) notFound();
  const specsText = ((product.specs as unknown as SpecGroup[]) ?? []).map((g) => [`## ${g.group}`, ...g.items.map((i) => `${i.label}: ${i.value}`)].join("\n")).join("\n\n");
  const colors = [...new Set(product.variants.map((v) => v.color).filter(Boolean))] as string[];
  return (
    <AdminPage title={product.name} description={<>{product.isActive ? "Live" : "Hidden"} · <Link href={`/p/${product.slug}`} target="_blank" className="underline">View in store ↗</Link></>}>
      {sp.created && <p className="rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700">Product created. Add variants and images, then make it visible.</p>}
      <Panel title="Variants, prices & stock"><VariantTable productId={product.id} variants={product.variants} /></Panel>
      <Panel title="Images"><ImageManager productId={product.id} images={product.images} colors={colors} /></Panel>
      <Panel title="Details">
        <ProductForm values={{ ...product, specsText }} brands={brands} categories={categories} />
      </Panel>
    </AdminPage>
  );
}
