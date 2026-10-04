"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/auth/guards";
import { advanceOrderStatus, cancelOrder, markRefunded, OrderError } from "@/lib/orders/service";

type Result = { ok?: string; error?: string };

const statusSchema = z.object({
  orderId: z.string().cuid(),
  to: z.enum(["PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"]),
  courierName: z.string().trim().max(60).optional(),
  trackingNumber: z.string().trim().max(60).optional(),
  trackingUrl: z.union([z.literal(""), z.string().trim().url().max(300)]).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function advanceStatusAction(_prev: Result, fd: FormData): Promise<Result> {
  const admin = await assertAdmin();
  const parsed = statusSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const { orderId, to, ...details } = parsed.data;
    await advanceOrderStatus(orderId, to, admin, details);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: `Order moved to ${to.replaceAll("_", " ").toLowerCase()}.` };
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Couldn't update the order." };
  }
}

export async function adminCancelAction(_prev: Result, fd: FormData): Promise<Result> {
  const admin = await assertAdmin();
  const id = z.string().cuid().safeParse(fd.get("orderId"));
  const reason = z.string().trim().min(3, "Enter a reason").max(300).safeParse(fd.get("reason"));
  if (!id.success) return { error: "Invalid order." };
  if (!reason.success) return { error: reason.error.issues[0].message };
  try {
    await cancelOrder(id.data, { reason: reason.data, actor: admin });
    for (const i of await db.orderItem.findMany({ where: { orderId: id.data }, select: { productSlug: true } })) revalidatePath(`/p/${i.productSlug}`);
    revalidatePath(`/admin/orders/${id.data}`);
    return { ok: "Order cancelled, stock restored and refund initiated where applicable." };
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Couldn't cancel the order." };
  }
}

export async function markRefundedAction(_prev: Result, fd: FormData): Promise<Result> {
  const admin = await assertAdmin();
  const id = z.string().cuid().safeParse(fd.get("orderId"));
  if (!id.success) return { error: "Invalid order." };
  try {
    await markRefunded(id.data, admin, String(fd.get("note") ?? "").slice(0, 300));
    revalidatePath(`/admin/orders/${id.data}`);
    return { ok: "Marked as refunded." };
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Couldn't update the refund." };
  }
}

export async function addOrderNoteAction(_prev: Result, fd: FormData): Promise<Result> {
  const admin = await assertAdmin();
  const id = z.string().cuid().safeParse(fd.get("orderId"));
  const note = z.string().trim().min(1, "Write a note").max(1000).safeParse(fd.get("note"));
  if (!id.success) return { error: "Invalid order." };
  if (!note.success) return { error: note.error.issues[0].message };
  const isPublic = fd.get("isPublic") === "on";
  await db.orderEvent.create({ data: { orderId: id.data, message: note.data, isPublic, actorId: admin.id } });
  revalidatePath(`/admin/orders/${id.data}`);
  return { ok: isPublic ? "Update posted to the customer's order timeline." : "Internal note added." };
}
