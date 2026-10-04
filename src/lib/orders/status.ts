import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUND_PENDING: "Refund initiated",
  REFUNDED: "Refunded",
};

/** Forward fulfilment path shown on the order tracker. */
export const FULFILMENT_STEPS: OrderStatus[] = ["CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

/** Allowed admin transitions. Cancellation and returns have dedicated flows. */
export const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  CONFIRMED: ["PACKED"],
  PACKED: ["SHIPPED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  RETURN_REQUESTED: ["RETURNED"],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT_STATUSES[from]?.includes(to) ?? false;
}

export const CUSTOMER_CANCELLABLE: OrderStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PACKED"];
export const ADMIN_CANCELLABLE: OrderStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PACKED", "SHIPPED"];

export function returnWindowOpen(deliveredAt: Date | null, days: number, now = new Date()): boolean {
  if (!deliveredAt || days <= 0) return false;
  return now.getTime() <= deliveredAt.getTime() + days * 86400_000;
}

export function statusTone(status: OrderStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "DELIVERED":
      return "success";
    case "CANCELLED":
    case "RETURNED":
      return "danger";
    case "PENDING_PAYMENT":
    case "RETURN_REQUESTED":
      return "warning";
    case "CONFIRMED":
      return "neutral";
    default:
      return "info";
  }
}
