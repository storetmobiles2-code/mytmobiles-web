import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { generateToken } from "./auth/tokens";
import { getCurrentUser } from "./auth/session";
import { getSettings } from "./settings";
import { computeTotals, evaluateCoupon, type PricingLine, type Totals } from "./pricing";
import type { Prisma } from "@/generated/prisma/client";

export const CART_COOKIE = "myt_cart";
const CART_COOKIE_DAYS = 60;
export const MAX_CART_LINES = 20;

const cartInclude = {
  items: {
    orderBy: { addedAt: "asc" },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              isActive: true,
              categoryId: true,
              brandId: true,
              gstRateBps: true,
              brand: { select: { name: true } },
              images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true, color: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export interface CartLineView {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  variantLabel: string;
  sku: string;
  image: { url: string; alt: string } | null;
  unitPrice: number;
  mrp: number;
  quantity: number;
  stock: number;
  maxQuantity: number;
  /** Set when the line cannot be bought as-is */
  issue: string | null;
}

export interface CartView {
  id: string | null;
  lines: CartLineView[];
  totals: Totals;
  coupon: { code: string; discount: number } | null;
  couponError: string | null;
  hasIssues: boolean;
}

export function variantLabel(v: { color: string | null; storage: string | null; ram: string | null }): string {
  return [v.ram && v.storage ? `${v.ram} RAM` : null, v.storage, v.color].filter(Boolean).join(" · ");
}

export function pickImage<T extends { color: string | null }>(images: T[], color: string | null): T | null {
  return images.find((i) => color && i.color === color) ?? images.find((i) => !i.color) ?? images[0] ?? null;
}

async function cartIdFromCookie(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

async function loadCart(): Promise<CartWithItems | null> {
  const user = await getCurrentUser();
  if (user) return db.cart.findUnique({ where: { userId: user.id }, include: cartInclude });
  const id = await cartIdFromCookie();
  if (!id) return null;
  return db.cart.findFirst({ where: { id, userId: null }, include: cartInclude });
}

/** Creates a cart if needed. Must be called from a Server Action / Route Handler (sets a cookie). */
export async function getOrCreateCartId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) {
    const cart = await db.cart.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
    return cart.id;
  }
  const existing = await cartIdFromCookie();
  if (existing) {
    const cart = await db.cart.findFirst({ where: { id: existing, userId: null }, select: { id: true } });
    if (cart) return cart.id;
  }
  // Unguessable id: the cookie is the only credential for a guest cart.
  const cart = await db.cart.create({ data: { id: generateToken(24) } });
  (await cookies()).set(CART_COOKIE, cart.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_COOKIE_DAYS * 86400,
  });
  return cart.id;
}

/** Moves a guest cart's items into the user's cart after sign-in. */
export async function mergeGuestCart(userId: string): Promise<void> {
  const guestId = await cartIdFromCookie();
  if (!guestId) return;
  const guest = await db.cart.findFirst({ where: { id: guestId, userId: null }, include: { items: true } });
  if (guest) {
    const target = await db.cart.upsert({ where: { userId }, update: {}, create: { userId } });
    await db.$transaction(async (tx) => {
      for (const item of guest.items) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { maxPerOrder: true } });
        if (!variant) continue;
        const existing = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: target.id, variantId: item.variantId } } });
        const quantity = Math.min(variant.maxPerOrder, (existing?.quantity ?? 0) + item.quantity);
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: target.id, variantId: item.variantId } },
          update: { quantity },
          create: { cartId: target.id, variantId: item.variantId, quantity },
        });
      }
      if (guest.couponCode && !target.couponCode) {
        await tx.cart.update({ where: { id: target.id }, data: { couponCode: guest.couponCode } });
      }
      await tx.cart.delete({ where: { id: guest.id } });
    });
  }
  (await cookies()).delete(CART_COOKIE);
}

export function toPricingLines(lines: CartLineView[], meta: Map<string, { categoryId: string; brandId: string; gstRateBps: number }>): PricingLine[] {
  return lines
    .filter((l) => !l.issue)
    .map((l) => {
      const m = meta.get(l.productId)!;
      return {
        variantId: l.variantId,
        productId: l.productId,
        categoryId: m.categoryId,
        brandId: m.brandId,
        unitPrice: l.unitPrice,
        mrp: l.mrp,
        quantity: l.quantity,
        gstRateBps: m.gstRateBps,
      };
    });
}

/** Builds the cart view with live prices, stock checks and coupon evaluation. */
export const getCartView = cache(async (paymentMethod?: "COD" | "RAZORPAY"): Promise<CartView> => {
  const [cart, settings, user] = await Promise.all([loadCart(), getSettings(), getCurrentUser()]);
  const meta = new Map<string, { categoryId: string; brandId: string; gstRateBps: number }>();

  const lines: CartLineView[] = (cart?.items ?? []).map((item) => {
    const v = item.variant;
    const p = v.product;
    meta.set(p.id, { categoryId: p.categoryId, brandId: p.brandId, gstRateBps: p.gstRateBps });
    const img = pickImage(p.images, v.color);
    const maxQuantity = Math.max(0, Math.min(v.maxPerOrder, v.stock));
    let issue: string | null = null;
    if (!p.isActive || !v.isActive) issue = "This item is no longer available.";
    else if (v.stock <= 0) issue = "Out of stock.";
    else if (item.quantity > v.stock) issue = `Only ${v.stock} left in stock — reduce the quantity.`;
    else if (item.quantity > v.maxPerOrder) issue = `Maximum ${v.maxPerOrder} per order.`;
    return {
      id: item.id,
      variantId: v.id,
      productId: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand.name,
      variantLabel: variantLabel(v),
      sku: v.sku,
      image: img ? { url: img.url, alt: img.alt } : null,
      unitPrice: v.price,
      mrp: v.mrp,
      quantity: item.quantity,
      stock: v.stock,
      maxQuantity,
      issue,
    };
  });

  const pricingLines = toPricingLines(lines, meta);
  let coupon: CartView["coupon"] = null;
  let couponError: string | null = null;
  if (cart?.couponCode) {
    const rule = await db.coupon.findUnique({ where: { code: cart.couponCode } });
    if (!rule) couponError = "This coupon code is not valid.";
    else {
      const [userRedemptions, userPaidOrders] = user
        ? await Promise.all([
            db.couponRedemption.count({ where: { couponId: rule.id, userId: user.id } }),
            db.order.count({ where: { userId: user.id, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } } }),
          ])
        : [undefined, undefined];
      const r = evaluateCoupon(rule, pricingLines, { now: new Date(), userRedemptions, userPaidOrders });
      if (r.ok) coupon = { code: rule.code, discount: r.discount };
      else couponError = r.reason;
    }
  }

  const totals = computeTotals(pricingLines, settings, { couponDiscount: coupon?.discount ?? 0, paymentMethod });
  return { id: cart?.id ?? null, lines, totals, coupon, couponError, hasIssues: lines.some((l) => l.issue) };
});

/** Item count for the header badge. */
export async function getCartCount(): Promise<number> {
  const user = await getCurrentUser();
  const where: Prisma.CartItemWhereInput = user
    ? { cart: { userId: user.id } }
    : { cart: { id: (await cartIdFromCookie()) ?? "__none__", userId: null } };
  const agg = await db.cartItem.aggregate({ where, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}
