"use client";

import { useActionState, useTransition } from "react";
import { Tag, X } from "lucide-react";
import { applyCoupon, removeCoupon, type CartActionResult } from "@/app/actions/cart";
import { SubmitButton } from "@/components/auth/submit-button";

export function CouponBox({ applied, error }: { applied: { code: string; discount: number } | null; error: string | null }) {
  const [state, action] = useActionState<CartActionResult | null, FormData>(applyCoupon, null);
  const [pending, start] = useTransition();
  if (applied || error) {
    const code = applied?.code;
    return (
      <div className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${applied ? "border-mint-600/30 bg-mint-50" : "border-danger-600/30 bg-danger-50"}`}>
        <div className="flex items-start gap-2">
          <Tag className={`mt-0.5 h-4 w-4 ${applied ? "text-mint-700" : "text-danger-700"}`} aria-hidden="true" />
          <div>
            {applied ? (
              <p className="font-semibold text-mint-700">Coupon {code} applied</p>
            ) : (
              <>
                <p className="font-semibold text-danger-700">Coupon can&apos;t be applied</p>
                <p className="text-danger-700">{error}</p>
              </>
            )}
          </div>
        </div>
        <button type="button" disabled={pending} onClick={() => start(async () => void (await removeCoupon()))} className="rounded p-1 text-ink-500 hover:text-ink-900" aria-label="Remove coupon">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="coupon" className="text-sm font-semibold text-ink-700">Have a coupon?</label>
      <div className="flex gap-2">
        <input id="coupon" name="code" placeholder="Enter code" autoCapitalize="characters" className="h-10 w-full rounded-xl border border-ink-300 px-3 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none" />
        <SubmitButton className="h-10 shrink-0" variant="outline" pendingText="…">Apply</SubmitButton>
      </div>
      {state && !state.ok && <p className="text-sm text-danger-700" role="alert">{state.error}</p>}
    </form>
  );
}
