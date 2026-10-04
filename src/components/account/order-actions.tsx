"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { cancelOrderAction, requestReturnAction, retryPaymentAction, verifyPaymentAction } from "@/app/actions/orders";
import { openRazorpay } from "@/components/checkout/razorpay";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError, FormSuccess } from "@/components/ui/field";
import { Button, Spinner } from "@/components/ui/button";

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(cancelOrderAction, {});
  if (state.success) return <FormSuccess message={state.success} />;
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}>Cancel order</Button>;
  return (
    <form action={action} className="space-y-3 rounded-xl border border-ink-200 p-4">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor="cancel-reason" className="block text-sm font-semibold">Why are you cancelling?</label>
      <select id="cancel-reason" name="reason" required className="h-10 w-full rounded-xl border border-ink-300 px-3 text-sm">
        <option value="">Select a reason</option>
        <option>Ordered by mistake</option>
        <option>Found a better price elsewhere</option>
        <option>Delivery date is too late</option>
        <option>Want to change colour / variant</option>
        <option>Want to change address or payment method</option>
        <option>Other</option>
      </select>
      <FormError message={state.error} />
      <div className="flex gap-2">
        <SubmitButton variant="danger" className="flex-1 sm:flex-none" pendingText="Cancelling…">Confirm cancellation</SubmitButton>
        <Button variant="ghost" onClick={() => setOpen(false)}>Keep order</Button>
      </div>
    </form>
  );
}

export function ReturnRequestForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(requestReturnAction, {});
  if (state.success) return <FormSuccess message={state.success} />;
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}>Request return / replacement</Button>;
  return (
    <form action={action} className="space-y-3 rounded-xl border border-ink-200 p-4">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor="return-reason" className="block text-sm font-semibold">Describe the problem</label>
      <textarea id="return-reason" name="reason" required minLength={10} maxLength={500} className="min-h-24 w-full rounded-xl border border-ink-300 p-3 text-sm" placeholder="E.g. screen has dead pixels, received wrong colour, item damaged in transit…" />
      <p className="text-xs text-ink-500">Returns are accepted for damaged, defective or wrong items. Keep the original box, accessories and invoice ready for pickup inspection.</p>
      <FormError message={state.error} />
      <div className="flex gap-2">
        <SubmitButton className="flex-1 sm:flex-none" pendingText="Submitting…">Submit request</SubmitButton>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function CompletePaymentButton({ orderId, label }: { orderId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await retryPaymentAction(orderId);
            if (!res.ok) return setError(res.error);
            if (res.next !== "pay") return;
            const outcome = await openRazorpay(res.razorpay);
            if (outcome.status === "paid") {
              const v = await verifyPaymentAction({ orderId, ...outcome.response });
              if (!v.ok) return setError(v.error);
              router.push(`/order-confirmation/${orderId}`);
            } else if (outcome.status === "failed") setError(`Payment failed: ${outcome.reason}`);
          })
        }
      >
        {pending && <Spinner />} {label}
      </Button>
      <FormError message={error} />
    </div>
  );
}
