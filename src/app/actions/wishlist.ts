"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { trackServer } from "@/lib/analytics";

export type WishlistResult = { ok: true; inWishlist: boolean } | { ok: false; reason: "auth" | "invalid" };

export async function toggleWishlist(productId: unknown): Promise<WishlistResult> {
  const id = z.string().cuid().safeParse(productId);
  if (!id.success) return { ok: false, reason: "invalid" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth" };
  const product = await db.product.findFirst({ where: { id: id.data, isActive: true }, select: { id: true } });
  if (!product) return { ok: false, reason: "invalid" };
  const key = { userId_productId: { userId: user.id, productId: product.id } };
  const existing = await db.wishlistItem.findUnique({ where: key });
  if (existing) {
    await db.wishlistItem.delete({ where: key });
    return { ok: true, inWishlist: false };
  }
  await db.wishlistItem.create({ data: { userId: user.id, productId: product.id } });
  void trackServer({ name: "add_to_wishlist", userId: user.id, productId: product.id });
  return { ok: true, inWishlist: true };
}
