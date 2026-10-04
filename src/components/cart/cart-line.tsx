"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { removeFromCart, saveForLater, updateCartQuantity } from "@/app/actions/cart";
import { notifySessionChanged } from "@/components/layout/session-provider";
import { ProductImage } from "@/components/product/product-image";
import { Price } from "@/components/ui/price";
import { track } from "@/lib/analytics-client";
import type { CartLineView } from "@/lib/cart";

export function CartLine({ line, signedIn }: { line: CartLineView; signedIn: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = Array.from({ length: Math.max(line.maxQuantity, line.quantity, 1) }, (_, i) => i + 1);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else {
        setError(null);
        notifySessionChanged();
      }
    });

  return (
    <li className={`flex gap-3 py-4 sm:gap-4 ${pending ? "opacity-60" : ""}`}>
      <Link href={`/p/${line.slug}`} className="w-20 shrink-0 sm:w-28">
        <ProductImage image={line.image} name={line.name} sizes="112px" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/p/${line.slug}`} className="line-clamp-2 font-semibold text-ink-900 hover:text-brand-700">{line.name}</Link>
        {line.variantLabel && <p className="mt-0.5 text-sm text-ink-500">{line.variantLabel}</p>}
        <Price price={line.unitPrice} mrp={line.mrp} size="sm" className="mt-1.5" />
        {line.issue && <p className="mt-1 text-sm font-semibold text-danger-700" role="alert">{line.issue}</p>}
        {error && <p className="mt-1 text-sm text-danger-700" role="alert">{error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {line.maxQuantity > 0 && (
            <label className="inline-flex items-center gap-2">
              <span className="text-ink-500">Qty</span>
              <select
                value={line.quantity}
                disabled={pending}
                onChange={(e) => run(() => updateCartQuantity(line.variantId, e.target.value))}
                className="h-9 rounded-lg border border-ink-300 bg-white px-2 font-semibold"
                aria-label={`Quantity for ${line.name}`}
              >
                {options.map((n) => (
                  <option key={n} value={n} disabled={n > line.maxQuantity}>{n}</option>
                ))}
              </select>
            </label>
          )}
          {signedIn && (
            <button type="button" disabled={pending} onClick={() => run(() => saveForLater(line.variantId))} className="font-semibold text-brand-700 hover:underline">
              Save for later
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await removeFromCart(line.variantId);
                if (r.ok) track("remove_from_cart", { productId: line.productId, value: line.unitPrice * line.quantity });
                return r;
              })
            }
            className="inline-flex items-center gap-1 font-semibold text-ink-500 hover:text-danger-700"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
          </button>
        </div>
      </div>
    </li>
  );
}
