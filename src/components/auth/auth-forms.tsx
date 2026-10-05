"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, requestPasswordReset, resetPassword, type FormState } from "@/app/actions/auth";
import { FormError, FormSuccess, TextField } from "@/components/ui/field";
import { SubmitButton } from "./submit-button";
import { DEMO } from "@/lib/demo";

/** Static preview: forms render normally but explain that accounts open at launch. */
async function previewAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.toLowerCase().includes("password")).map(([k, v]) => [k, String(v)]));
  return { error: "Customer accounts open when the online store launches. This is a preview.", values };
}

const initial: FormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(DEMO ? previewAction : login, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormError message={state.error} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-semibold text-brand-700 hover:underline">Forgot password?</Link>
      </div>
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(DEMO ? previewAction : register, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormError message={state.error} />
      <TextField label="Full name" name="name" autoComplete="name" required defaultValue={state.values?.name} error={state.fieldErrors?.name} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <TextField label="Mobile number" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" optional defaultValue={state.values?.phone} error={state.fieldErrors?.phone} hint="For delivery updates. 10-digit Indian mobile." />
      <TextField label="Password" name="password" type="password" autoComplete="new-password" required error={state.fieldErrors?.password} hint="At least 8 characters, with a letter and a number." />
      <label className="flex items-start gap-2.5 text-sm text-ink-700">
        <input type="checkbox" name="marketingOptIn" className="mt-0.5 h-4 w-4 accent-brand-600" />
        Send me offers and new arrivals by email (optional)
      </label>
      <div>
        <label className="flex items-start gap-2.5 text-sm text-ink-700">
          <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 accent-brand-600" aria-invalid={state.fieldErrors?.terms ? true : undefined} />
          <span>I agree to the <Link href="/terms" className="font-semibold text-brand-700 underline">Terms</Link> and <Link href="/privacy" className="font-semibold text-brand-700 underline">Privacy Policy</Link>.</span>
        </label>
        {state.fieldErrors?.terms && <p className="mt-1 text-sm text-danger-700" role="alert">{state.fieldErrors.terms}</p>}
      </div>
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(DEMO ? previewAction : requestPasswordReset, initial);
  if (state.success) return <FormSuccess message={state.success} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(DEMO ? previewAction : resetPassword, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormError message={state.error} />
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required error={state.fieldErrors?.password} hint="At least 8 characters, with a letter and a number." />
      <TextField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required error={state.fieldErrors?.confirm} />
      <SubmitButton pendingText="Saving…">Set new password</SubmitButton>
    </form>
  );
}
