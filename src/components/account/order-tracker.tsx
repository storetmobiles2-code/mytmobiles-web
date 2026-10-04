import { Check } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { FULFILMENT_STEPS, ORDER_STATUS_LABEL } from "@/lib/orders/status";
import { cn } from "@/lib/cn";

export function OrderTracker({ status, events }: { status: OrderStatus; events: { status: OrderStatus | null; createdAt: Date }[] }) {
  if (status === "CANCELLED" || status === "PENDING_PAYMENT") return null;
  const flow: OrderStatus[] = status === "RETURN_REQUESTED" || status === "RETURNED" ? [...FULFILMENT_STEPS, "RETURN_REQUESTED", "RETURNED"] : FULFILMENT_STEPS;
  const current = flow.indexOf(status);
  const when = (s: OrderStatus) => events.find((e) => e.status === s)?.createdAt;
  return (
    <ol className="grid gap-0 sm:flex" aria-label="Order progress">
      {flow.map((s, i) => {
        const done = i <= current;
        const at = when(s);
        return (
          <li key={s} className="relative flex gap-3 pb-5 sm:flex-1 sm:flex-col sm:items-center sm:pb-0 sm:text-center">
            {i < flow.length - 1 && <span className={cn("absolute top-7 left-[13px] h-[calc(100%-1.75rem)] w-0.5 sm:top-[13px] sm:left-1/2 sm:h-0.5 sm:w-full", i < current ? "bg-mint-600" : "bg-ink-200")} aria-hidden="true" />}
            <span className={cn("relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2", done ? "border-mint-600 bg-mint-600 text-white" : "border-ink-300 bg-white")}>{done && <Check className="h-4 w-4" aria-hidden="true" />}</span>
            <span className="sm:mt-2">
              <span className={cn("block text-sm font-semibold", done ? "text-ink-900" : "text-ink-400")}>{ORDER_STATUS_LABEL[s]}</span>
              {at && <span className="block text-xs text-ink-500">{at.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
              <span className="sr-only">{done ? "completed" : "pending"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
