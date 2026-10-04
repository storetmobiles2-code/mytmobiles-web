import { formatINR } from "@/lib/money";
import type { Totals } from "@/lib/pricing";

export function PriceSummary({ totals, couponCode, title = "Price details" }: { totals: Totals; couponCode?: string | null; title?: string }) {
  return (
    <section aria-labelledby="price-details">
      <h2 id="price-details" className="text-sm font-bold tracking-wide text-ink-500 uppercase">{title}</h2>
      <dl className="mt-3 space-y-2.5 text-sm">
        <div className="flex justify-between"><dt>Price ({totals.itemCount} {totals.itemCount === 1 ? "item" : "items"})</dt><dd className="tabular-nums">{formatINR(totals.mrpTotal)}</dd></div>
        {totals.productSavings > 0 && <div className="flex justify-between text-mint-700"><dt>Discount on MRP</dt><dd className="tabular-nums">− {formatINR(totals.productSavings)}</dd></div>}
        {totals.couponDiscount > 0 && <div className="flex justify-between text-mint-700"><dt>Coupon {couponCode ? `(${couponCode})` : ""}</dt><dd className="tabular-nums">− {formatINR(totals.couponDiscount)}</dd></div>}
        <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular-nums">{totals.shippingFee === 0 ? <span className="font-semibold text-mint-700">Free</span> : formatINR(totals.shippingFee)}</dd></div>
        {totals.codFee > 0 && <div className="flex justify-between"><dt>Cash on Delivery fee</dt><dd className="tabular-nums">{formatINR(totals.codFee)}</dd></div>}
        <div className="flex justify-between border-t border-dashed border-ink-200 pt-3 text-base font-bold"><dt>Total amount</dt><dd className="tabular-nums">{formatINR(totals.total)}</dd></div>
      </dl>
      <p className="mt-1 text-xs text-ink-500">Inclusive of GST</p>
      {totals.totalSavings > 0 && <p className="mt-3 rounded-lg bg-mint-50 px-3 py-2 text-sm font-semibold text-mint-700">You save {formatINR(totals.totalSavings)} on this order</p>}
      {totals.freeShippingGap > 0 && <p className="mt-3 text-xs text-ink-500">Add {formatINR(totals.freeShippingGap)} more for free delivery.</p>}
    </section>
  );
}
