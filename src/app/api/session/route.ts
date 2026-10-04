import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCartCount } from "@/lib/cart";
import { db } from "@/lib/db";
import { razorpayConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const [cartCount, wishlist] = await Promise.all([
    getCartCount(),
    user ? db.wishlistItem.findMany({ where: { userId: user.id }, select: { productId: true } }) : [],
  ]);
  return NextResponse.json(
    {
      user: user ? { name: user.name, role: user.role } : null,
      cartCount,
      wishlist: wishlist.map((w) => w.productId),
      razorpayEnabled: razorpayConfigured(),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
