import { db } from "@/lib/db";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-forms";

export const metadata = { title: "New product" };

export default async function NewProduct() {
  const [brands, categories] = await Promise.all([db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }), db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, hsnCode: true } })]);
  return (
    <AdminPage title="New product" description="Create the product, then add variants (colour / memory, price, stock) and images.">
      <Panel><ProductForm values={{ isActive: false, hsnCode: "85171300", gstRateBps: 1800, returnWindowDays: 7 }} brands={brands} categories={categories} /></Panel>
    </AdminPage>
  );
}
