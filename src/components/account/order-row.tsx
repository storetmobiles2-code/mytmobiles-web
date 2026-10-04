import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { formatINR } from "@/lib/money";
import { ORDER_STATUS_LABEL, statusTone } from "@/lib/orders/status";
import { Badge } from "@/components/ui/misc";
import { ProductImage } from "@/components/product/product-image";

export function OrderRow({ order }: { order: { id: string; orderNumber: string; status: OrderStatus; total: number; placedAt: Date; items: { productName: string; imageUrl: string | null; quantity: number }[] } }) {
  const first = order.items[0];
  return (
    <li>
      <Link href={`/account/orders/${order.id}`} className="flex items-center gap-4 rounded-xl p-3 hover:bg-ink-50">
        <div className="w-16 shrink-0"><ProductImage image={first?.imageUrl ? { url: first.imageUrl, alt: "" } : null} name={first?.productName ?? ""} sizes="64px" /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{first?.productName}{order.items.length > 1 ? ` + ${order.items.length - 1} more` : ""}</p>
          <p className="text-sm text-ink-500">{order.orderNumber} · {order.placedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
          <div className="mt-1 flex items-center gap-2"><Badge tone={statusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge><span className="text-sm font-semibold">{formatINR(order.total)}</span></div>
        </div>
        <ChevronRight className="h-5 w-5 text-ink-500" aria-hidden="true" />
      </Link>
    </li>
  );
}
