import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [products, categories, brands] = await Promise.all([
    db.product.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } } }),
    db.category.findMany({ where: { isActive: true, products: { some: { isActive: true } } }, select: { slug: true, updatedAt: true } }),
    db.brand.findMany({ where: { isActive: true, products: { some: { isActive: true } } }, select: { slug: true, updatedAt: true } }),
  ]);
  const staticPages = ["", "/offers", "/open-box", "/about", "/contact", "/help/shipping", "/help/returns", "/help/payments", "/privacy", "/terms"];
  return [
    ...staticPages.map((p) => ({ url: `${site}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.4 })),
    ...categories.map((c) => ({ url: `${site}/c/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...brands.map((b) => ({ url: `${site}/brands/${b.slug}`, lastModified: b.updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
    ...products.map((p) => ({ url: `${site}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.7, images: p.images.map((i) => `${site}${i.url}`) })),
  ];
}
