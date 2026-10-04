import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";

/**
 * Cached, non-personalised data used by layouts. Invalidated by admin edits
 * via revalidateTag("catalog") / revalidateTag("settings").
 */
export const getNavData = unstable_cache(
  async () => {
    const categories = await db.category.findMany({
      where: { isActive: true, parentId: null, products: { some: { isActive: true } } },
      orderBy: { sortOrder: "asc" },
      select: { name: true, slug: true },
    });
    const brands = await db.brand.findMany({
      where: { isActive: true, products: { some: { isActive: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, slug: true },
    });
    const openBox = await db.product.count({ where: { isActive: true, condition: "DEMO" } });
    return { categories, brands, hasOpenBox: openBox > 0 };
  },
  ["nav-data"],
  { revalidate: 600, tags: ["catalog"] },
);

export const getPublicSettings = unstable_cache(
  async () => {
    const s = await db.storeSettings.upsert({ where: { id: "store" }, update: {}, create: { id: "store" } });
    return {
      storeName: s.storeName,
      legalName: s.legalName,
      gstin: s.gstin,
      supportEmail: s.supportEmail,
      supportPhone: s.supportPhone,
      address: [s.addressLine1, s.addressLine2, [s.city, s.state, s.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      city: s.city,
      state: s.state,
      freeShippingThreshold: s.freeShippingThreshold,
      shippingFee: s.shippingFee,
      codEnabled: s.codEnabled,
      codFee: s.codFee,
      codMaxOrderValue: s.codMaxOrderValue,
      returnWindowDays: 7,
      paymentWindowMinutes: s.paymentWindowMinutes,
    };
  },
  ["public-settings"],
  { revalidate: 600, tags: ["settings"] },
);

export type PublicSettings = Awaited<ReturnType<typeof getPublicSettings>>;
