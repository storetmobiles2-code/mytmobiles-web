import "server-only";
import { db } from "@/lib/db";

export function getOrderForUser(orderId: string, userId: string) {
  return db.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: { include: { product: { select: { returnWindowDays: true, slug: true } } } },
      events: { where: { isPublic: true }, orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export type UserOrder = NonNullable<Awaited<ReturnType<typeof getOrderForUser>>>;
