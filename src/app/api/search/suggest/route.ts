import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ items: [] });
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  const items = await db.product.findMany({
    where: {
      isActive: true,
      AND: tokens.map((t) => ({
        OR: [{ name: { contains: t, mode: "insensitive" as const } }, { keywords: { has: t } }, { brand: { name: { contains: t, mode: "insensitive" as const } } }],
      })),
    },
    select: { slug: true, name: true, priceFrom: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: [{ inStock: "desc" }, { isFeatured: "desc" }, { condition: "asc" }],
    take: 6,
  });
  return NextResponse.json(
    { items: items.map((i) => ({ slug: i.slug, name: i.name, priceFrom: i.priceFrom, image: i.images[0]?.url ?? null })) },
    { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
  );
}
