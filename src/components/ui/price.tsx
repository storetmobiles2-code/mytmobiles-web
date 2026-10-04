import { discountPercent, formatINR } from "@/lib/money";
import { cn } from "@/lib/cn";

export function Price({
  price,
  mrp,
  size = "md",
  from = false,
  className,
}: {
  price: number;
  mrp?: number;
  size?: "sm" | "md" | "lg";
  from?: boolean;
  className?: string;
}) {
  const off = mrp ? discountPercent(mrp, price) : 0;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-bold text-ink-900 tabular-nums", size === "lg" ? "text-3xl" : size === "md" ? "text-lg" : "text-base")}>
        {from && <span className="mr-1 text-xs font-medium text-ink-500">from</span>}
        {formatINR(price)}
      </span>
      {off > 0 && mrp && (
        <>
          <span className={cn("text-ink-500 line-through tabular-nums", size === "lg" ? "text-base" : "text-sm")}>
            <span className="sr-only">MRP </span>
            {formatINR(mrp)}
          </span>
          <span className={cn("font-semibold text-mint-700", size === "lg" ? "text-base" : "text-sm")}>{off}% off</span>
        </>
      )}
    </div>
  );
}
