"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/guards";
import { cancelPermissions, statusChangePermission } from "@/lib/auth/permissions";
import { advanceOrderStatus, cancelOrder, markRefunded, OrderError } from "@/lib/orders/service";
import { audit } from "@/lib/admin/audit";
import { diffChanges } from "@/lib/admin/audit-diff";

type Result = { ok?: string; error?: string };

const statusSchema = z.object({
  orderId: z.string().cuid(),
  to: z.enum(["PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"]),
  courierName: z.string().trim().max(60).optional(),
  trackingNumber: z.string().trim().max(60).optional(),
  trackingUrl: z.union([z.literal(""), z.string().trim().url().max(300)]).optional(),
  note: z.string().trim().max(500).optional(),
});

/** The order fields an admin action can change, for before/after in the audit log. */
const auditedOrder = { orderNumber: true, status: true, paymentMethod: true, paymentStatus: true, courierName: true, trackingNumber: true, trackingUrl: true, invoiceNumber: true, cancelReason: true, total: true } as const;
const orderSnapshot = (id: string) => db.order.findUnique({ where: { id }, select: auditedOrder });
type OrderSnapshot = NonNullable<Awaited<ReturnType<typeof orderSnapshot>>>;
const ORDER_FIELDS: (keyof OrderSnapshot)[] = ["status", "paymentStatus", "courierName", "trackingNumber", "trackingUrl", "invoiceNumber", "cancelReason"];

/** A refund sent back through Razorpay by a cancellation or a return. */
async function auditOnlineRefund(actor: { id: string; email: string }, orderId: string, before: OrderSnapshot, after: OrderSnapshot | null, why: string) {
  if (!after || before.paymentMethod !== "RAZORPAY" || before.paymentStatus !== "PAID" || after.paymentStatus === "PAID") return;
  await audit({
    actor,
    action: "refund.issued",
    entityType: "order",
    entityId: orderId,
    summary: `Refund of ₹${(after.total / 100).toLocaleString("en-IN")} started for ${after.orderNumber} (${why})`,
    changes: { paymentStatus: { before: before.paymentStatus, after: after.paymentStatus } },
  });
}

export async function advanceStatusAction(_prev: Result, fd: FormData): Promise<Result> {
  // Receiving a return starts a refund, so it needs the refund permission.
  const admin = await assertPermission(statusChangePermission(String(fd.get("to") ?? "")));
  const parsed = statusSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const { orderId, to, ...details } = parsed.data;
    const before = await orderSnapshot(orderId);
    await advanceOrderStatus(orderId, to, admin, details);
    const after = await orderSnapshot(orderId);
    if (before && after) {
      await audit({
        actor: admin,
        action: "order.status_changed",
        entityType: "order",
        entityId: orderId,
        summary: `${after.orderNumber}: ${before.status} → ${after.status}${to === "SHIPPED" ? ` (${details.courierName} ${details.trackingNumber})` : ""}${details.note ? ` · note: ${details.note}` : ""}`,
        changes: diffChanges(before, after, ORDER_FIELDS),
      });
      await auditOnlineRefund(admin, orderId, before, after, "order returned");
    }
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: `Order moved to ${to.replaceAll("_", " ").toLowerCase()}.` };
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Couldn't update the order." };
  }
}

export async function adminCancelAction(_prev: Result, fd: FormData): Promise<Result> {
  const admin = await assertPermission("orders.cancel");
  const id = z.string().cuid().safeParse(fd.get("orderId"));
  const reason = z.string().trim().min(3, "Enter a reason").max(300).safeParse(fd.get("reason"));
  if (!id.success) return { error: "Invalid order." };
  if (!reason.success) return { error: reason.error.issues[0].message };
  const before = await orderSnapshot(id.data);
  if (!before) return { error: "Order not found." };
  // Cancelling a paid online order sends money back: that is a refund.
  await assertPermission(...cancelPermissions(before));
  try {
    await cancelOrder(id.data, { reason: reason.data, actor: admin });
    const after = await orderSnapshot(id.data);
    await audit({
      actor: admin,
      action: "order.cancelled",
      entityType: "order",
      entityId: id.data,
      summary: `${before.orderNumber} cancelled: ${reason.data}`,
      changes: after ? diffChanges(before, after, ORDER_FIELDS) : null,
    });
    await auditOnlineRefund(admin, id.data, before, after, "order cancelled");
    for (const i of await db.orderItem.findMany({ where: { orderId: id.data }, select: { productSlug: true } })) revalidatePath(`/p/${i.productSlug}`);
    revalidatePath(`/admin/orders/${id.data}`);
    return { ok: "Order cancelled, stock restored and refund initiated where applicable." };
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Couldn't cancel the order." };
  }
}

export async function markRefundedAction(_prev: Result, fd: FormData): Promise<Result> {
  const admin = await assertPermission("orders.refund");
  const id = z.string().cuid().safeParse(fd.get("orderId"));
  if (!id.success) return { error: "Invalid order." };
  const note = String(fd.get("note") ?? "").slice(0, 300);
  try {
    const before = await orderSnapshot(id.data);
    await markRefunded(id.data, admin, note);
    if (before) {
      await audit({
        actor: admin,
        action: "refund.completed",
        entityType: "order",
        entityId: id.data,
        summary: `${before.orderNumber}: refund marked as paid${note ? ` (${note})` : ""}`,
        changes: { paymentStatus: { before: before.paymentStatus, after: "REFUNDED" } },
      });
    }
    revalidatePath(`/admin/orders/${id.data}`);
    return { ok: "Marked as refunded." };
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Couldn't update the refund." };
  }
}

export async function addOrderNoteAction(_prev: Result, fd: FormData): Promise<Result> {
  const admin = await assertPermission("orders.update");
  const id = z.string().cuid().safeParse(fd.get("orderId"));
  const note = z.string().trim().min(1, "Write a note").max(1000).safeParse(fd.get("note"));
  if (!id.success) return { error: "Invalid order." };
  if (!note.success) return { error: note.error.issues[0].message };
  const isPublic = fd.get("isPublic") === "on";
  const order = await db.order.findUnique({ where: { id: id.data }, select: { orderNumber: true } });
  if (!order) return { error: "Order not found." };
  await db.orderEvent.create({ data: { orderId: id.data, message: note.data, isPublic, actorId: admin.id } });
  await audit({
    actor: admin,
    action: "order.note_added",
    entityType: "order",
    entityId: id.data,
    summary: `${order.orderNumber}: ${isPublic ? "update shown to customer" : "internal note"}: ${note.data}`,
  });
  revalidatePath(`/admin/orders/${id.data}`);
  return { ok: isPublic ? "Update posted to the customer's order timeline." : "Internal note added." };
}
