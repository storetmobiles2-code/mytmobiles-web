"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { saveAddress, type AddressFormState } from "@/app/actions/account";
import { FormError, SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { STATE_NAMES } from "@/lib/indian-states";

export interface AddressValues {
  id?: string;
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string | null;
  landmark?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  type?: string;
  isDefault?: boolean;
}

export function AddressForm({ initial, onSaved, onCancel, submitLabel = "Save address" }: { initial?: AddressValues; onSaved?: (id: string) => void; onCancel?: () => void; submitLabel?: string }) {
  const [state, action, isPending] = useActionState<AddressFormState, FormData>(saveAddress, {});
  const v = { ...initial, ...state.values } as AddressValues;
  const [city, setCity] = useState(v.city ?? "");
  const [st, setSt] = useState(v.state ?? "");
  const [pinNote, setPinNote] = useState<string | null>(null);
  const lastSaved = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (state.addressId && state.addressId !== lastSaved.current) {
      lastSaved.current = state.addressId;
      onSaved?.(state.addressId);
    }
  }, [state.addressId, onSaved]);

  async function autofill(pin: string) {
    if (!/^[1-9][0-9]{5}$/.test(pin)) return;
    try {
      const res = await fetch(`/api/pincode/${pin}`);
      const body = await res.json();
      if (!res.ok) return setPinNote(body.error ?? null);
      if (body.state && STATE_NAMES.includes(body.state)) setSt(body.state);
      if (body.city && !city) setCity(body.city);
      setPinNote(body.serviceable ? null : "We don't deliver to this pincode yet.");
    } catch {
      /* lookup is a convenience; the user can still type city/state */
    }
  }

  return (
    // Submitted via a transition (not the form "action" prop) so React doesn't auto-reset
    // the form — that would desync the controlled City/State fields after a validation error.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-4"
      noValidate
    >
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" name="fullName" autoComplete="name" required defaultValue={v.fullName} error={state.fieldErrors?.fullName} />
        <TextField label="Mobile number" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required defaultValue={v.phone} error={state.fieldErrors?.phone} />
        <TextField label="Pincode" name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} required defaultValue={v.pincode} onBlur={(e) => autofill(e.target.value)} error={state.fieldErrors?.pincode ?? pinNote ?? undefined} />
        <TextField label="City / District" name="city" autoComplete="address-level2" required value={city} onChange={(e) => setCity(e.target.value)} error={state.fieldErrors?.city} />
      </div>
      <TextField label="Flat / House no., Building, Street" name="line1" autoComplete="address-line1" required defaultValue={v.line1} error={state.fieldErrors?.line1} />
      <TextField label="Area / Locality" name="line2" autoComplete="address-line2" optional defaultValue={v.line2 ?? ""} error={state.fieldErrors?.line2} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Landmark" name="landmark" optional defaultValue={v.landmark ?? ""} error={state.fieldErrors?.landmark} />
        <SelectField label="State" name="state" autoComplete="address-level1" required value={st} onChange={(e) => setSt(e.target.value)} error={state.fieldErrors?.state}>
          <option value="">Select state</option>
          {STATE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectField>
      </div>
      <fieldset className="flex flex-wrap items-center gap-4 text-sm">
        <legend className="sr-only">Address type</legend>
        {(["HOME", "WORK", "OTHER"] as const).map((t) => (
          <label key={t} className="inline-flex items-center gap-2">
            <input type="radio" name="type" value={t} defaultChecked={(v.type ?? "HOME") === t} className="h-4 w-4 accent-brand-600" />
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </label>
        ))}
        <label className="ml-auto inline-flex items-center gap-2">
          <input type="checkbox" name="isDefault" defaultChecked={v.isDefault} className="h-4 w-4 accent-brand-600" /> Make default
        </label>
      </fieldset>
      <div className="flex gap-3">
        <SubmitButton className="flex-1 sm:flex-none" pendingText="Saving…" pending={isPending}>{submitLabel}</SubmitButton>
        {onCancel && <button type="button" onClick={onCancel} className="h-11 rounded-xl px-4 font-semibold text-ink-700 hover:bg-ink-100">Cancel</button>}
      </div>
    </form>
  );
}
