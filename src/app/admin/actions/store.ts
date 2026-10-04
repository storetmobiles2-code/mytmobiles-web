"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/auth/guards";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import { storeImageUpload, UploadError } from "@/lib/admin/media";
import { rupeesToPaise } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { isValidGstin } from "@/lib/gst";
import { STATE_NAMES } from "@/lib/indian-states";
import { destroyAllSessions } from "@/lib/auth/session";

export type R = { ok?: string; error?: string };
const firstIssue = (e: z.ZodError) => `${String(e.issues[0].path[0] ?? "")}: ${e.issues[0].message}`.replace(/^: /, "");
const optDate = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.date().optional());
const csvIds = (v: FormDataEntryValue[]) => v.map(String).filter(Boolean);

// ───────── Coupons ─────────
const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/, "3–24 letters, numbers, - or _"),
  description: z.string().trim().min(3).max(200),
  type: z.enum(["PERCENT", "FLAT"]),
  value: z.coerce.number().positive(),
  maxDiscount: z.string().optional(),
  minOrderValue: z.string().optional(),
  startsAt: optDate,
  endsAt: optDate,
  usageLimit: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().positive().optional()),
  perUserLimit: z.coerce.number().int().min(1).max(100),
});

export async function saveCoupon(_prev: R, fd: FormData): Promise<R> {
  await assertAdmin();
  const parsed = couponSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const c = parsed.data;
  if (c.type === "PERCENT" && (c.value > 90 || !Number.isInteger(c.value))) return { error: "Percentage must be a whole number up to 90." };
  if (c.startsAt && c.endsAt && c.endsAt < c.startsAt) return { error: "End date must be after the start date." };
  const id = String(fd.get("id") ?? "") || null;
  const data = {
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.type === "PERCENT" ? c.value : rupeesToPaise(c.value),
    maxDiscount: c.maxDiscount ? rupeesToPaise(c.maxDiscount) : null,
    minOrderValue: c.minOrderValue ? rupeesToPaise(c.minOrderValue) : 0,
    startsAt: c.startsAt ?? null,
    endsAt: c.endsAt ?? null,
    usageLimit: c.usageLimit ?? null,
    perUserLimit: c.perUserLimit,
    firstOrderOnly: fd.get("firstOrderOnly") === "on",
    isActive: fd.get("isActive") === "on",
    isPublic: fd.get("isPublic") === "on",
    applicableCategoryIds: csvIds(fd.getAll("categoryIds")),
    applicableBrandIds: csvIds(fd.getAll("brandIds")),
  };
  const clash = await db.coupon.findFirst({ where: { code: data.code, ...(id ? { NOT: { id } } : {}) } });
  if (clash) return { error: "A coupon with this code already exists." };
  if (id) await db.coupon.update({ where: { id }, data });
  else await db.coupon.create({ data });
  revalidatePath("/admin/coupons");
  revalidatePath("/offers");
  return { ok: "Coupon saved." };
}

// ───────── Banners ─────────
const bannerSchema = z.object({
  title: z.string().trim().min(2).max(80),
  eyebrow: z.string().trim().max(40).optional(),
  subtitle: z.string().trim().max(160).optional(),
  ctaLabel: z.string().trim().min(2).max(30),
  href: z.string().trim().regex(/^\/[^\s]*$/, "Use a site path like /c/smartphones"),
  imageUrl: z.string().trim().max(300).optional(),
  imageAlt: z.string().trim().max(160).optional(),
  bgFrom: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bgTo: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textTone: z.enum(["light", "dark"]),
  sortOrder: z.coerce.number().int().min(0).max(999),
  startsAt: optDate,
  endsAt: optDate,
});

export async function saveBanner(_prev: R, fd: FormData): Promise<R> {
  await assertAdmin();
  const parsed = bannerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  let imageUrl = parsed.data.imageUrl || null;
  const file = fd.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      imageUrl = (await storeImageUpload(file)).url;
    } catch (err) {
      return { error: err instanceof UploadError ? err.message : "Image upload failed." };
    }
  }
  const id = String(fd.get("id") ?? "") || null;
  const data = { ...parsed.data, eyebrow: parsed.data.eyebrow || null, subtitle: parsed.data.subtitle || null, imageAlt: parsed.data.imageAlt || null, imageUrl, startsAt: parsed.data.startsAt ?? null, endsAt: parsed.data.endsAt ?? null, isActive: fd.get("isActive") === "on" };
  if (id) await db.banner.update({ where: { id }, data });
  else await db.banner.create({ data });
  revalidateStorefront();
  return { ok: "Banner saved." };
}

export async function deleteBanner(id: string): Promise<R> {
  await assertAdmin();
  await db.banner.deleteMany({ where: { id } });
  revalidateStorefront();
  return { ok: "Deleted" };
}

// ───────── Categories & brands ─────────
export async function saveCategory(_prev: R, fd: FormData): Promise<R> {
  await assertAdmin();
  const parsed = z
    .object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).optional(), sortOrder: z.coerce.number().int().min(0).max(999), hsnCode: z.string().trim().regex(/^(\d{4,8})?$/, "HSN must be 4–8 digits") })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const id = String(fd.get("id") ?? "") || null;
  const data = { ...parsed.data, description: parsed.data.description || null, hsnCode: parsed.data.hsnCode || null, isActive: fd.get("isActive") === "on" };
  if (id) await db.category.update({ where: { id }, data });
  else {
    const slug = slugify(parsed.data.name);
    if (await db.category.findUnique({ where: { slug } })) return { error: "A category with this name exists." };
    await db.category.create({ data: { ...data, slug } });
  }
  revalidateStorefront();
  return { ok: "Category saved." };
}

export async function saveBrand(_prev: R, fd: FormData): Promise<R> {
  await assertAdmin();
  const parsed = z.object({ name: z.string().trim().min(1).max(60), sortOrder: z.coerce.number().int().min(0).max(999) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const id = String(fd.get("id") ?? "") || null;
  const data = { ...parsed.data, isActive: fd.get("isActive") === "on" };
  const clash = await db.brand.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) } });
  if (clash) return { error: "Brand already exists." };
  if (id) await db.brand.update({ where: { id }, data });
  else await db.brand.create({ data: { ...data, slug: slugify(data.name) } });
  revalidateStorefront();
  return { ok: "Brand saved." };
}

// ───────── Reviews ─────────
export async function setReviewStatus(reviewId: string, status: "PUBLISHED" | "HIDDEN"): Promise<R> {
  await assertAdmin();
  const review = await db.review.update({ where: { id: reviewId }, data: { status }, select: { productId: true, product: { select: { slug: true } } } });
  const agg = await db.review.aggregate({ where: { productId: review.productId, status: "PUBLISHED" }, _avg: { rating: true }, _count: true });
  await db.product.update({ where: { id: review.productId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
  revalidatePath(`/p/${review.product.slug}`);
  revalidatePath("/admin/reviews");
  return { ok: status === "HIDDEN" ? "Review hidden." : "Review published." };
}

// ───────── Customers ─────────
export async function setUserDisabled(userId: string, disabled: boolean): Promise<R> {
  const admin = await assertAdmin();
  if (userId === admin.id) return { error: "You can't disable your own account." };
  await db.user.update({ where: { id: userId }, data: { isDisabled: disabled } });
  if (disabled) await destroyAllSessions(userId);
  revalidatePath(`/admin/customers/${userId}`);
  return { ok: disabled ? "Account disabled and signed out." : "Account enabled." };
}

export async function setUserRole(userId: string, role: "CUSTOMER" | "ADMIN"): Promise<R> {
  const admin = await assertAdmin();
  if (userId === admin.id) return { error: "You can't change your own role." };
  await db.user.update({ where: { id: userId }, data: { role } });
  await destroyAllSessions(userId); // force re-login with new permissions
  revalidatePath(`/admin/customers/${userId}`);
  return { ok: role === "ADMIN" ? "User is now an admin." : "Admin access removed." };
}

// ───────── Settings ─────────
const paise = (v: unknown) => rupeesToPaise(String(v ?? "0") || "0");
const pins = (v: FormDataEntryValue | null) => [...new Set(String(v ?? "").split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^\d{2,6}$/.test(s)))];

export async function saveSettings(_prev: R, fd: FormData): Promise<R> {
  await assertAdmin();
  const o = Object.fromEntries(fd) as Record<string, string>;
  const gstin = (o.gstin ?? "").trim().toUpperCase();
  if (gstin && !isValidGstin(gstin)) return { error: "GSTIN is not valid (check the 15 characters)." };
  if (o.state && !(STATE_NAMES as readonly string[]).includes(o.state)) return { error: "Choose a valid state." };
  if (o.pincode && !/^[1-9]\d{5}$/.test(o.pincode)) return { error: "Dispatch pincode must be 6 digits." };
  if (o.supportEmail && !z.email().safeParse(o.supportEmail).success) return { error: "Support email is not valid." };
  const prefix = (o.invoicePrefix ?? "MYT").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "MYT";
  const nums = z
    .object({
      deliveryDaysLocal: z.coerce.number().int().min(0).max(30),
      deliveryDaysState: z.coerce.number().int().min(0).max(30),
      deliveryDaysNational: z.coerce.number().int().min(0).max(30),
      deliveryDaysRemote: z.coerce.number().int().min(0).max(45),
      paymentWindowMinutes: z.coerce.number().int().min(10).max(1440),
    })
    .safeParse(o);
  if (!nums.success) return { error: firstIssue(nums.error) };
  let money;
  try {
    money = { freeShippingThreshold: paise(o.freeShippingThreshold), shippingFee: paise(o.shippingFee), codFee: paise(o.codFee), codMaxOrderValue: paise(o.codMaxOrderValue) };
  } catch {
    return { error: "Enter amounts as numbers." };
  }
  await db.storeSettings.update({
    where: { id: "store" },
    data: {
      storeName: (o.storeName || "myT Mobiles").slice(0, 80),
      legalName: (o.legalName ?? "").trim().slice(0, 120),
      gstin,
      supportEmail: (o.supportEmail ?? "").trim(),
      supportPhone: (o.supportPhone ?? "").trim().slice(0, 20),
      addressLine1: (o.addressLine1 ?? "").trim().slice(0, 120),
      addressLine2: (o.addressLine2 ?? "").trim().slice(0, 120),
      city: (o.city ?? "").trim().slice(0, 60),
      state: o.state ?? "",
      pincode: o.pincode ?? "",
      invoicePrefix: prefix,
      ...money,
      ...nums.data,
      codEnabled: fd.get("codEnabled") === "on",
      remotePincodePrefixes: pins(fd.get("remotePincodePrefixes")),
      blockedPincodes: pins(fd.get("blockedPincodes")),
      codBlockedPincodes: pins(fd.get("codBlockedPincodes")),
    },
  });
  revalidateStorefront(["settings", "catalog"]);
  return { ok: "Settings saved." };
}
