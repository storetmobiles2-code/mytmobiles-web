"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOrCreateCartId, MAX_CART_LINES } from "@/lib/cart";
import { clientIp, getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { couponCodeSchema } from "@/lib/validation";
import { trackServer } from "@/lib/analytics";

export type CartActionResult = { ok: true; message?: string } | { ok: false; error: string };

const variantId = z.string().cuid();
const qty = z.coerce.number().int().min(1).max(10);

async function guard(): Promise<CartActionResult | null> {
  if (!(await rateLimit(`cart:${await clientIp()}`, 60, 60))) return { ok: false, error: "Too many requests — please wait a moment." };
  return null;
}

export async function addToCart(rawVariantId: unknown, rawQty: unknown = 1): Promise<CartActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;
  const v = variantId.safeParse(rawVariantId);
  const q = qty.safeParse(rawQty);
  if (!v.success || !q.success) return { ok: false, error: "Invalid selection." };

  const variant = await db.productVariant.findFirst({
    where: { id: v.data, isActive: true, product: { isActive: true } },
    select: { id: true, stock: true, maxPerOrder: true, productId: true, price: true },
  });
  if (!variant) return { ok: false, error: "This item is no longer available." };
  if (variant.stock <= 0) return { ok: false, error: "Sorry, this item is out of stock." };

  const cartId = await getOrCreateCartId();
  const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId: variant.id } } });
  if (!existing && (await db.cartItem.count({ where: { cartId } })) >= MAX_CART_LINES)
    return { ok: false, error: `Your cart can hold up to ${MAX_CART_LINES} different items.` };

  const limit = Math.min(variant.stock, variant.maxPerOrder);
  const wanted = (existing?.quantity ?? 0) + q.data;
  const quantity = Math.min(wanted, limit);
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId: variant.id } },
    update: { quantity },
    create: { cartId, variantId: variant.id, quantity },
  });
  const user = await getCurrentUser();
  void trackServer({ name: "add_to_cart", userId: user?.id, productId: variant.productId, value: variant.price * q.data });
  revalidatePath("/cart");
  if (quantity < wanted) return { ok: true, message: `Added. Maximum ${limit} per order for this item.` };
  return { ok: true, message: "Added to cart." };
}

export async function updateCartQuantity(rawVariantId: unknown, rawQty: unknown): Promise<CartActionResult> {
  const v = variantId.safeParse(rawVariantId);
  const q = z.coerce.number().int().min(0).max(10).safeParse(rawQty);
  if (!v.success || !q.success) return { ok: false, error: "Invalid quantity." };
  const cartId = await getOrCreateCartId();
  if (q.data === 0) {
    await db.cartItem.deleteMany({ where: { cartId, variantId: v.data } });
  } else {
    const variant = await db.productVariant.findUnique({ where: { id: v.data }, select: { stock: true, maxPerOrder: true } });
    if (!variant) return { ok: false, error: "Item not found." };
    const quantity = Math.min(q.data, Math.max(1, Math.min(variant.stock, variant.maxPerOrder)));
    await db.cartItem.updateMany({ where: { cartId, variantId: v.data }, data: { quantity } });
  }
  revalidatePath("/cart");
  return { ok: true };
}

export async function removeFromCart(rawVariantId: unknown): Promise<CartActionResult> {
  const v = variantId.safeParse(rawVariantId);
  if (!v.success) return { ok: false, error: "Invalid item." };
  const cartId = await getOrCreateCartId();
  await db.cartItem.deleteMany({ where: { cartId, variantId: v.data } });
  revalidatePath("/cart");
  return { ok: true };
}

/** Moves an item from the cart to the wishlist (requires sign-in). */
export async function saveForLater(rawVariantId: unknown): Promise<CartActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to save items to your wishlist." };
  const v = variantId.safeParse(rawVariantId);
  if (!v.success) return { ok: false, error: "Invalid item." };
  const variant = await db.productVariant.findUnique({ where: { id: v.data }, select: { productId: true } });
  if (!variant) return { ok: false, error: "Item not found." };
  await db.wishlistItem.upsert({
    where: { userId_productId: { userId: user.id, productId: variant.productId } },
    update: {},
    create: { userId: user.id, productId: variant.productId },
  });
  const cartId = await getOrCreateCartId();
  await db.cartItem.deleteMany({ where: { cartId, variantId: v.data } });
  revalidatePath("/cart");
  return { ok: true, message: "Moved to your wishlist." };
}

export async function applyCoupon(_prev: CartActionResult | null, formData: FormData): Promise<CartActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;
  const code = couponCodeSchema.safeParse(formData.get("code"));
  if (!code.success) return { ok: false, error: code.error.issues[0].message };
  const coupon = await db.coupon.findUnique({ where: { code: code.data } });
  if (!coupon || !coupon.isActive) return { ok: false, error: "This coupon code is not valid." };
  const cartId = await getOrCreateCartId();
  await db.cart.update({ where: { id: cartId }, data: { couponCode: coupon.code } });
  revalidatePath("/cart");
  revalidatePath("/checkout");
  // Eligibility (min order, brand/category rules, limits) is evaluated live in the cart view.
  return { ok: true, message: `Coupon ${coupon.code} applied.` };
}

export async function removeCoupon(): Promise<CartActionResult> {
  const cartId = await getOrCreateCartId();
  await db.cart.update({ where: { id: cartId }, data: { couponCode: null } });
  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { ok: true };
}
