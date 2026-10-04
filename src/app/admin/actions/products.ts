"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/auth/guards";
import { refreshProductAggregates } from "@/lib/catalog/queries";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import { storeImageUpload, UploadError } from "@/lib/admin/media";
import { slugify } from "@/lib/slug";
import { rupeesToPaise } from "@/lib/money";

export type AdminResult = { ok?: string; error?: string; fieldErrors?: Record<string, string> };

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** "## Group" headings followed by "Label: Value" lines. */
export async function parseSpecs(text: string) {
  const groups: { group: string; items: { label: string; value: string }[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("##")) groups.push({ group: line.replace(/^#+\s*/, ""), items: [] });
    else {
      const i = line.indexOf(":");
      if (i <= 0) continue;
      if (!groups.length) groups.push({ group: "Specifications", items: [] });
      groups[groups.length - 1].items.push({ label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
    }
  }
  return groups.filter((g) => g.items.length);
}

const productSchema = z.object({
  name: z.string().trim().min(3).max(160),
  slug: z.string().trim().max(120).optional(),
  brandId: z.string().cuid({ message: "Choose a brand" }),
  categoryId: z.string().cuid({ message: "Choose a category" }),
  condition: z.enum(["NEW", "DEMO"]),
  shortDescription: z.string().trim().min(10, "Short description must be at least 10 characters").max(300),
  description: z.string().trim().min(10).max(10000),
  warranty: z.string().trim().max(300).optional(),
  hsnCode: z.string().trim().regex(/^\d{4,8}$/, "HSN must be 4–8 digits"),
  gstRateBps: z.coerce.number().int().refine((v) => [0, 500, 1200, 1800, 2800].includes(v), "Choose a valid GST rate"),
  returnWindowDays: z.coerce.number().int().min(0).max(30),
  manufacturerInfo: z.string().trim().max(500).optional(),
  countryOfOrigin: z.string().trim().max(60).optional(),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(170).optional(),
});

export async function saveProduct(_prev: AdminResult, fd: FormData): Promise<AdminResult> {
  await assertAdmin();
  const parsed = productSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Please fix the highlighted fields.", fieldErrors: fe };
  }
  const id = String(fd.get("id") ?? "") || null;
  const p = parsed.data;
  const slug = slugify(p.slug || p.name);
  const clash = await db.product.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { error: "Another product already uses this URL slug.", fieldErrors: { slug: "Slug already in use" } };

  const data = {
    ...p,
    slug,
    warranty: p.warranty || null,
    manufacturerInfo: p.manufacturerInfo || null,
    countryOfOrigin: p.countryOfOrigin || null,
    seoTitle: p.seoTitle || null,
    seoDescription: p.seoDescription || null,
    highlights: lines(fd.get("highlights")).slice(0, 12),
    keywords: lines(String(fd.get("keywords") ?? "").replace(/,/g, "\n")).map((k) => k.toLowerCase()).slice(0, 40),
    boxContents: lines(fd.get("boxContents")).slice(0, 20),
    specs: await parseSpecs(String(fd.get("specs") ?? "")),
    is5G: fd.get("is5G") === "on",
    isFeatured: fd.get("isFeatured") === "on",
    isActive: fd.get("isActive") === "on",
  };
  const saved = id ? await db.product.update({ where: { id }, data }) : await db.product.create({ data });
  revalidateStorefront();
  if (!id) redirect(`/admin/products/${saved.id}?created=1`);
  return { ok: "Product saved." };
}

export async function setProductActive(productId: string, active: boolean): Promise<AdminResult> {
  await assertAdmin();
  const p = await db.product.findUnique({ where: { id: productId }, select: { _count: { select: { variants: true } } } });
  if (!p) return { error: "Not found" };
  if (active && p._count.variants === 0) return { error: "Add at least one variant before publishing." };
  await db.product.update({ where: { id: productId }, data: { isActive: active } });
  revalidateStorefront();
  return { ok: active ? "Product is live." : "Product hidden." };
}

const variantSchema = z.object({
  productId: z.string().cuid(),
  id: z.string().optional(),
  sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9._-]+$/, "Letters, numbers, dot, dash or underscore only"),
  color: z.string().trim().max(40).optional(),
  colorHex: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB")]).optional(),
  ramGb: z.union([z.literal(""), z.coerce.number().int().min(1).max(64)]).optional(),
  storageGb: z.union([z.literal(""), z.coerce.number().int().min(1).max(4096)]).optional(),
  price: z.string().min(1, "Price is required"),
  mrp: z.string().optional(),
  maxPerOrder: z.coerce.number().int().min(1).max(10),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000),
});

export async function saveVariant(_prev: AdminResult, fd: FormData): Promise<AdminResult> {
  const admin = await assertAdmin();
  const parsed = variantSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join(" · ") };
  const v = parsed.data;
  let price: number, mrp: number;
  try {
    price = rupeesToPaise(v.price);
    mrp = v.mrp ? rupeesToPaise(v.mrp) : price;
  } catch {
    return { error: "Enter prices as numbers, e.g. 24999 or 24999.50" };
  }
  if (price <= 0) return { error: "Price must be greater than zero." };
  if (mrp < price) return { error: "MRP can't be lower than the selling price." };
  const sku = v.sku.toUpperCase();
  if (await db.productVariant.findFirst({ where: { sku, ...(v.id ? { NOT: { id: v.id } } : {}) }, select: { id: true } })) return { error: "SKU already exists." };

  const storageGb = v.storageGb === "" || v.storageGb === undefined ? null : v.storageGb;
  const ramGb = v.ramGb === "" || v.ramGb === undefined ? null : v.ramGb;
  const data = {
    sku,
    color: v.color || null,
    colorHex: v.colorHex || null,
    ramGb,
    storageGb,
    ram: ramGb ? `${ramGb} GB` : null,
    storage: storageGb ? (storageGb >= 1024 && storageGb % 1024 === 0 ? `${storageGb / 1024} TB` : `${storageGb} GB`) : null,
    price,
    mrp,
    maxPerOrder: v.maxPerOrder,
    lowStockThreshold: v.lowStockThreshold,
    isActive: fd.get("isActive") === "on",
    externalNames: lines(fd.get("externalNames")),
  };
  if (v.id) {
    await db.productVariant.update({ where: { id: v.id }, data });
  } else {
    const initialStock = Math.max(0, Math.floor(Number(fd.get("stock") ?? 0)) || 0);
    const created = await db.productVariant.create({ data: { ...data, productId: v.productId, stock: initialStock } });
    if (initialStock > 0) await db.inventoryLog.create({ data: { variantId: created.id, delta: initialStock, reason: "Opening stock", actorId: admin.id } });
  }
  await refreshProductAggregates([v.productId]);
  revalidateStorefront();
  return { ok: "Variant saved." };
}

export async function deleteVariant(variantId: string): Promise<AdminResult> {
  await assertAdmin();
  const v = await db.productVariant.findUnique({ where: { id: variantId }, select: { productId: true, _count: { select: { orderItems: true } } } });
  if (!v) return { error: "Not found" };
  if (v._count.orderItems > 0) {
    // Keep history intact: deactivate instead of deleting a variant that has been ordered.
    await db.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
  } else {
    await db.productVariant.delete({ where: { id: variantId } });
  }
  await refreshProductAggregates([v.productId]);
  revalidateStorefront();
  return { ok: v._count.orderItems > 0 ? "Variant has orders, so it was deactivated instead of deleted." : "Variant deleted." };
}

export async function uploadProductImage(_prev: AdminResult, fd: FormData): Promise<AdminResult> {
  await assertAdmin();
  const productId = z.string().cuid().safeParse(fd.get("productId"));
  if (!productId.success) return { error: "Invalid product." };
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Choose at least one image." };
  const product = await db.product.findUniqueOrThrow({ where: { id: productId.data }, select: { name: true, _count: { select: { images: true } } } });
  const color = String(fd.get("color") ?? "").trim() || null;
  const credit = String(fd.get("credit") ?? "").trim().slice(0, 120) || null;
  const sourceUrl = String(fd.get("sourceUrl") ?? "").trim().slice(0, 500) || null;
  const license = String(fd.get("license") ?? "").trim().slice(0, 500) || null;
  try {
    let order = product._count.images;
    for (const f of files.slice(0, 10)) {
      const img = await storeImageUpload(f);
      await db.productImage.create({
        data: { productId: productId.data, url: img.url, width: img.width, height: img.height, color, alt: `${product.name}${color ? ` in ${color}` : ""}`, sortOrder: order++, credit, sourceUrl, license },
      });
    }
  } catch (err) {
    return { error: err instanceof UploadError ? err.message : "Upload failed." };
  }
  revalidateStorefront();
  return { ok: `${files.length} image(s) uploaded.` };
}

export async function updateImage(imageId: string, patch: { alt?: string; color?: string | null; move?: -1 | 1 }): Promise<AdminResult> {
  await assertAdmin();
  const img = await db.productImage.findUnique({ where: { id: imageId } });
  if (!img) return { error: "Not found" };
  if (patch.move) {
    const siblings = await db.productImage.findMany({ where: { productId: img.productId }, orderBy: { sortOrder: "asc" } });
    const i = siblings.findIndex((s) => s.id === imageId);
    const j = i + patch.move;
    if (j >= 0 && j < siblings.length) {
      [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
      await db.$transaction(siblings.map((s, k) => db.productImage.update({ where: { id: s.id }, data: { sortOrder: k } })));
    }
  } else {
    await db.productImage.update({
      where: { id: imageId },
      data: { ...(patch.alt !== undefined ? { alt: patch.alt.slice(0, 200) } : {}), ...(patch.color !== undefined ? { color: patch.color || null } : {}) },
    });
  }
  revalidateStorefront();
  return { ok: "Saved" };
}

export async function deleteImage(imageId: string): Promise<AdminResult> {
  await assertAdmin();
  await db.productImage.deleteMany({ where: { id: imageId } });
  revalidateStorefront();
  return { ok: "Image removed." };
}
