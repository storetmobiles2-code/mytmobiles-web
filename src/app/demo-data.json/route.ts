import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cardSelect } from "@/lib/catalog/queries";
import { getSettings } from "@/lib/settings";
import { getPublicSettings } from "@/lib/public-data";
import { DEMO, type DemoData } from "@/lib/demo";

/** Catalogue snapshot for the static preview's browser-side search, wishlist and delivery checks. */
export async function GET() {
  if (!DEMO) return new NextResponse("Not found", { status: 404 });
  const [s, pub, products] = await Promise.all([
    getSettings(),
    getPublicSettings(),
    db.product.findMany({
      where: { isActive: true },
      select: {
        ...cardSelect,
        keywords: true,
        createdAt: true,
        category: { select: { slug: true } },
        variants: { where: { isActive: true }, select: { ...cardSelect.variants.select, ramGb: true, storageGb: true }, orderBy: cardSelect.variants.orderBy },
      },
      orderBy: [{ inStock: "desc" }, { isFeatured: "desc" }, { condition: "asc" }],
    }),
  ]);
  const data: DemoData = {
    settings: {
      pincode: s.pincode ?? "",
      state: s.state ?? "",
      deliveryDaysLocal: s.deliveryDaysLocal,
      deliveryDaysState: s.deliveryDaysState,
      deliveryDaysNational: s.deliveryDaysNational,
      deliveryDaysRemote: s.deliveryDaysRemote,
      remotePincodePrefixes: s.remotePincodePrefixes,
      blockedPincodes: s.blockedPincodes,
      codBlockedPincodes: s.codBlockedPincodes,
      codEnabled: s.codEnabled,
      storeName: pub.storeName,
      supportPhone: pub.supportPhone,
      supportEmail: pub.supportEmail,
      address: pub.address,
      shippingFee: pub.shippingFee,
      freeShippingThreshold: pub.freeShippingThreshold,
      codFee: pub.codFee,
    },
    products: products.map(({ category, createdAt, variants, ...p }) => ({
      ...p,
      variants: variants.map((v) => ({ id: v.id, color: v.color, colorHex: v.colorHex, storage: v.storage, ram: v.ram, stock: v.stock, price: v.price })),
      ram: [...new Set(variants.map((v) => v.ramGb).filter((n): n is number => n !== null))],
      storage: [...new Set(variants.map((v) => v.storageGb).filter((n): n is number => n !== null))],
      categorySlug: category.slug,
      createdAt: createdAt.toISOString(),
    })),
  };
  return NextResponse.json(data);
}
