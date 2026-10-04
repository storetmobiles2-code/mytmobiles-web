"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { addressSchema, fieldErrors, formDataToObject, mobileSchema, passwordSchema, reviewSchema } from "@/lib/validation";
import { lookupPincode } from "@/lib/pincode";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "./auth";

const MAX_ADDRESSES = 10;

async function requireUserForAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type AddressFormState = FormState & { addressId?: string };

export async function saveAddress(_prev: AddressFormState, fd: FormData): Promise<AddressFormState> {
  const user = await requireUserForAction();
  const raw = formDataToObject(fd);
  const parsed = addressSchema.safeParse({ ...raw, isDefault: fd.get("isDefault") === "on" });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };
  const a = parsed.data;

  const pin = await lookupPincode(a.pincode);
  if (pin.isValid === false) return { fieldErrors: { pincode: "This pincode doesn't exist." }, values: raw };
  if (pin.state && pin.state !== a.state) return { fieldErrors: { state: `Pincode ${a.pincode} is in ${pin.state}.` }, values: raw };

  const id = typeof raw.id === "string" && raw.id ? raw.id : null;
  if (id) {
    const owned = await db.address.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!owned) return { error: "Address not found." };
  } else if ((await db.address.count({ where: { userId: user.id } })) >= MAX_ADDRESSES) {
    return { error: `You can save up to ${MAX_ADDRESSES} addresses. Delete one to add another.` };
  }

  const isFirst = (await db.address.count({ where: { userId: user.id } })) === 0;
  const data = {
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 || null,
    landmark: a.landmark || null,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    type: a.type,
    isDefault: a.isDefault || isFirst,
  };
  const saved = await db.$transaction(async (tx) => {
    if (data.isDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    return id ? tx.address.update({ where: { id }, data }) : tx.address.create({ data: { ...data, userId: user.id } });
  });
  revalidatePath("/checkout");
  revalidatePath("/account/addresses");
  return { success: "Address saved.", addressId: saved.id };
}

export async function deleteAddress(addressId: unknown): Promise<{ ok: boolean }> {
  const user = await requireUserForAction();
  const id = z.string().cuid().safeParse(addressId);
  if (!id.success) return { ok: false };
  await db.address.deleteMany({ where: { id: id.data, userId: user.id } });
  const remaining = await db.address.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  if (remaining && !(await db.address.count({ where: { userId: user.id, isDefault: true } }))) {
    await db.address.update({ where: { id: remaining.id }, data: { isDefault: true } });
  }
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { ok: true };
}

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUserForAction();
  const values = formDataToObject(fd);
  const parsed = z
    .object({ name: z.string().trim().min(2, "Name is required").max(80), phone: z.union([z.literal(""), mobileSchema]) })
    .safeParse({ name: values.name, phone: values.phone ?? "" });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  await db.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone || null, marketingOptIn: fd.get("marketingOptIn") === "on" },
  });
  revalidatePath("/account");
  return { success: "Profile updated." };
}

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUserForAction();
  if (!(await rateLimit(`pw-change:${user.id}`, 5, 900))) return { error: "Too many attempts. Try again in 15 minutes." };
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(String(fd.get("current") ?? ""), record.passwordHash))) return { fieldErrors: { current: "Current password is incorrect." } };
  const next = passwordSchema.safeParse(fd.get("password"));
  if (!next.success) return { fieldErrors: { password: next.error.issues[0].message } };
  if (fd.get("password") !== fd.get("confirm")) return { fieldErrors: { confirm: "Passwords don't match." } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next.data) } });
  return { success: "Password changed." };
}

/** Only customers with a delivered order containing the product may review it. */
export async function submitReview(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUserForAction();
  const productId = z.string().cuid().safeParse(fd.get("productId"));
  if (!productId.success) return { error: "Invalid product." };
  const parsed = reviewSchema.safeParse({ rating: fd.get("rating"), title: fd.get("title"), body: fd.get("body") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: formDataToObject(fd) };
  const purchased = await db.orderItem.findFirst({
    where: { productId: productId.data, order: { userId: user.id, status: { in: ["DELIVERED", "RETURN_REQUESTED", "RETURNED"] } } },
    select: { id: true },
  });
  if (!purchased) return { error: "Only customers who received this product from us can review it." };

  const product = await db.product.findUniqueOrThrow({ where: { id: productId.data }, select: { slug: true } });
  await db.$transaction(async (tx) => {
    await tx.review.upsert({
      where: { productId_userId: { productId: productId.data, userId: user.id } },
      update: { ...parsed.data, status: "PUBLISHED", isVerifiedPurchase: true },
      create: { ...parsed.data, productId: productId.data, userId: user.id, isVerifiedPurchase: true },
    });
    const agg = await tx.review.aggregate({ where: { productId: productId.data, status: "PUBLISHED" }, _avg: { rating: true }, _count: true });
    await tx.product.update({ where: { id: productId.data }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
  });
  revalidatePath(`/p/${product.slug}`);
  return { success: "Thanks! Your review is live." };
}
