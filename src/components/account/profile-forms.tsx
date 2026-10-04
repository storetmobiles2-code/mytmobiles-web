"use client";

import { useActionState } from "react";
import { changePassword, updateProfile } from "@/app/actions/account";
import type { FormState } from "@/app/actions/auth";
import { FormError, FormSuccess, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";

export function ProfileForm({ name, phone, email, marketingOptIn }: { name: string; phone: string; email: string; marketingOptIn: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormSuccess message={state.success} />
      <FormError message={state.error} />
      <TextField label="Email" value={email} disabled readOnly hint="Contact support to change your email address." />
      <TextField label="Full name" name="name" defaultValue={state.values?.name ?? name} autoComplete="name" required error={state.fieldErrors?.name} />
      <TextField label="Mobile number" name="phone" type="tel" defaultValue={state.values?.phone ?? phone} autoComplete="tel-national" optional error={state.fieldErrors?.phone} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="marketingOptIn" defaultChecked={marketingOptIn} className="h-4 w-4 accent-brand-600" /> Email me offers and new arrivals</label>
      <SubmitButton className="w-full sm:w-auto" pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePassword, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormSuccess message={state.success} />
      <FormError message={state.error} />
      <TextField label="Current password" name="current" type="password" autoComplete="current-password" required error={state.fieldErrors?.current} />
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required error={state.fieldErrors?.password} hint="At least 8 characters, with a letter and a number." />
      <TextField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required error={state.fieldErrors?.confirm} />
      <SubmitButton className="w-full sm:w-auto" pendingText="Updating…">Change password</SubmitButton>
    </form>
  );
}
