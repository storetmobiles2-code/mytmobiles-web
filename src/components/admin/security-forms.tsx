"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { confirmTwoFactorSetup, disableTwoFactor, regenerateRecoveryCodes, type SecurityState } from "@/app/admin/actions/security";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { FormError, FormSuccess } from "@/components/ui/field";
import { Field, inputCls } from "@/components/admin/action-form";

const codeInput = { name: "code", autoComplete: "one-time-code", inputMode: "numeric" as const, required: true, className: `${inputCls} max-w-48 font-mono tracking-widest` };

/** Shown once, straight after the codes are created. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-ink-900">Save your recovery codes now</p>
      <p className="text-sm text-ink-700">
        Each code signs you in once if you lose your phone. Keep them somewhere safe, such as a password manager or a printed copy. They won&apos;t be shown again.
      </p>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-ink-900 sm:max-w-md" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(codes.join("\n"));
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy codes"}
      </Button>
    </div>
  );
}

export function EnrolForm() {
  const router = useRouter();
  const [state, action] = useActionState<SecurityState, FormData>(confirmTwoFactorSetup, {});
  if (state.codes) {
    return (
      <div className="space-y-4">
        <FormSuccess message={state.ok} />
        <RecoveryCodes codes={state.codes} />
        {/* Refreshes the whole page, layout included, so the full admin menu appears. */}
        <Button onClick={() => router.refresh()}>I&apos;ve saved my codes</Button>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <FormError message={state.error} />
      <Field label="6-digit code from the app">
        <input {...codeInput} />
      </Field>
      <SubmitButton className="w-full sm:w-auto" pendingText="Checking…">Turn on two-factor sign-in</SubmitButton>
    </form>
  );
}

export function RegenerateCodesForm() {
  const router = useRouter();
  const [state, action] = useActionState<SecurityState, FormData>(regenerateRecoveryCodes, {});
  useEffect(() => {
    if (state.codes) router.refresh(); // updates the "unused codes" count
  }, [state, router]);
  return (
    <div className="space-y-3">
      <FormSuccess message={state.ok} />
      {state.codes && <RecoveryCodes codes={state.codes} />}
      <form action={action} className="space-y-3">
        <FormError message={state.error} />
        <Field label="Current code from your app" hint="Or one of your unused recovery codes.">
          <input {...codeInput} inputMode="text" />
        </Field>
        <SubmitButton className="w-full sm:w-auto" variant="outline" pendingText="Creating…">Create new recovery codes</SubmitButton>
      </form>
    </div>
  );
}

export function DisableForm() {
  const [state, action] = useActionState<SecurityState, FormData>(disableTwoFactor, {});
  return (
    <form action={action} className="space-y-3">
      <FormError message={state.error} />
      <FormSuccess message={state.ok} />
      <div className="grid gap-3 sm:max-w-md">
        <Field label="Your password">
          <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
        </Field>
        <Field label="Current code from your app" hint="Or one of your unused recovery codes.">
          <input {...codeInput} inputMode="text" />
        </Field>
      </div>
      <SubmitButton className="w-full sm:w-auto" variant="danger" pendingText="Turning off…">Turn off two-factor sign-in</SubmitButton>
    </form>
  );
}
