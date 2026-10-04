"use client";

import { useActionState } from "react";
import { addOrderNoteAction, adminCancelAction, advanceStatusAction, markRefundedAction } from "@/app/admin/actions/orders";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError, FormSuccess } from "@/components/ui/field";

type R = { ok?: string; error?: string };
const input = "h-10 w-full rounded-xl border border-ink-300 px-3 text-sm";

function Feedback({ state }: { state: R }) {
  return (
    <>
      <FormSuccess message={state.ok} />
      <FormError message={state.error} />
    </>
  );
}

const LABEL: Record<string, string> = { PACKED: "Mark packed", SHIPPED: "Mark shipped", OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Mark delivered", RETURNED: "Return received" };

export function AdvanceStatusForm({ orderId, next }: { orderId: string; next: string[] }) {
  const [state, action] = useActionState<R, FormData>(advanceStatusAction, {});
  if (!next.length) return null;
  return (
    <div className="space-y-3">
      <Feedback state={state} />
      {next.map((to) => (
        <form key={to} action={action} className="space-y-2 rounded-xl border border-ink-200 p-3">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="to" value={to} />
          {to === "SHIPPED" && (
            <div className="grid gap-2 sm:grid-cols-3">
              <input name="courierName" required placeholder="Courier (e.g. Delhivery)" className={input} aria-label="Courier name" />
              <input name="trackingNumber" required placeholder="AWB / tracking no." className={input} aria-label="Tracking number" />
              <input name="trackingUrl" type="url" placeholder="Tracking URL (optional)" className={input} aria-label="Tracking URL" />
            </div>
          )}
          {to === "RETURNED" && <p className="text-xs text-ink-500">Restocks the items. Prepaid orders are refunded automatically via Razorpay; COD refunds must be paid by bank transfer, then marked refunded.</p>}
          <input name="note" placeholder="Internal note (optional)" className={input} aria-label="Internal note" />
          <SubmitButton className="w-full sm:w-auto" pendingText="Updating…">{LABEL[to] ?? to}</SubmitButton>
        </form>
      ))}
    </div>
  );
}

export function AdminCancelForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState<R, FormData>(adminCancelAction, {});
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <input name="reason" required placeholder="Reason (shown to customer)" className={input} aria-label="Cancellation reason" />
      <SubmitButton variant="danger" className="w-full sm:w-auto" pendingText="Cancelling…">Cancel order</SubmitButton>
    </form>
  );
}

export function MarkRefundedForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState<R, FormData>(markRefundedAction, {});
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <input name="note" placeholder="Reference (e.g. NEFT UTR)" className={input} aria-label="Refund reference" />
      <SubmitButton variant="outline" className="w-full sm:w-auto" pendingText="Saving…">Mark refund completed</SubmitButton>
    </form>
  );
}

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState<R, FormData>(addOrderNoteAction, {});
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <textarea name="note" required maxLength={1000} placeholder="Add a note…" className="min-h-20 w-full rounded-xl border border-ink-300 p-3 text-sm" aria-label="Note" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" className="h-4 w-4 accent-brand-600" /> Show to customer on order timeline</label>
      <SubmitButton variant="outline" className="w-full sm:w-auto" pendingText="Saving…">Add note</SubmitButton>
    </form>
  );
}
