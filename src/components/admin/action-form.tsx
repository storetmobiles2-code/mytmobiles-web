"use client";

import { useRouter } from "next/navigation";
import { useActionState, useTransition, type ReactNode } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError, FormSuccess } from "@/components/ui/field";

type R = { ok?: string; error?: string };

/** Generic admin form bound to a server action returning { ok | error }. */
export function ActionForm({ action, children, submitLabel = "Save", className = "space-y-3" }: { action: (prev: R, fd: FormData) => Promise<R>; children: ReactNode; submitLabel?: string; className?: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState<R, FormData>(async (prev, fd) => {
    const r = await action(prev, fd);
    if (r.ok) router.refresh();
    return r;
  }, {});
  return (
    <form action={formAction} className={className}>
      <FormSuccess message={state.ok} />
      <FormError message={state.error} />
      {children}
      <SubmitButton className="w-full sm:w-auto" pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}

/** Small button that calls a server action and refreshes. */
export function ActionButton({ run, children, confirmText, className = "text-sm font-semibold text-brand-700" }: { run: () => Promise<R>; children: ReactNode; confirmText?: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (confirmText && !confirm(confirmText)) return;
        start(async () => {
          const r = await run();
          if (r.error) alert(r.error);
          router.refresh();
        });
      }}
    >
      {children}
    </button>
  );
}

export const inputCls = "mt-1 h-10 w-full rounded-xl border border-ink-300 px-3 text-sm";
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-ink-700">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-ink-500">{hint}</span>}
    </label>
  );
}
