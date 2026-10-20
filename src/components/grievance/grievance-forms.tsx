"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { fileGrievance, trackGrievance, type FileGrievanceState, type TrackGrievanceState } from "@/app/actions/grievances";
import { GRIEVANCE_CATEGORIES, GRIEVANCE_CATEGORY_LABEL, grievanceStatusTone } from "@/lib/grievances/rules";
import { FormError, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/cn";

export interface GrievancePrefill {
  name?: string;
  email?: string;
  phone?: string;
  orderNumber?: string;
}

export function GrievanceForm({ prefill }: { prefill: GrievancePrefill }) {
  const [state, action] = useActionState<FileGrievanceState, FormData>(fileGrievance, {});
  if (state.filed) {
    const f = state.filed;
    return (
      <div role="status" className="rounded-2xl border border-mint-600/30 bg-mint-50 p-5">
        <p className="flex items-center gap-2 font-bold text-mint-700">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Your complaint has been filed
        </p>
        <p className="mt-3 text-sm text-ink-700">Your ticket number is</p>
        <p className="font-mono text-2xl font-extrabold tracking-wide text-ink-900" data-testid="grievance-ticket">{f.ticket}</p>
        <ul className="mt-3 text-sm">
          <li>We will acknowledge it by <strong>{f.acknowledgeBy}</strong> (within 48 hours).</li>
          <li>We will resolve it by <strong>{f.resolveBy}</strong> (within one month).</li>
        </ul>
        <p className="mt-3 text-sm">
          {f.emailed ? <>We have emailed the ticket number to <strong>{f.email}</strong>. </> : <>Please note the ticket number. </>}
          Track your complaint below with the ticket number and your email.
        </p>
      </div>
    );
  }
  const v = state.values ?? {};
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" name="name" autoComplete="name" required maxLength={80} defaultValue={v.name ?? prefill.name} error={err.name} />
        <TextField label="Email" name="email" type="email" autoComplete="email" required defaultValue={v.email ?? prefill.email} error={err.email} hint="We send the ticket number and updates here." />
        <TextField label="Mobile number" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" optional defaultValue={v.phone ?? prefill.phone} error={err.phone} />
        <TextField label="Order number" name="orderNumber" optional maxLength={30} defaultValue={v.orderNumber ?? prefill.orderNumber} error={err.orderNumber} hint="e.g. MYT-261004-7KQ2XD, if it's about an order" />
      </div>
      <SelectField label="What is it about?" name="category" required defaultValue={v.category ?? ""} error={err.category}>
        <option value="" disabled>Choose one…</option>
        {GRIEVANCE_CATEGORIES.map((c) => (
          <option key={c} value={c}>{GRIEVANCE_CATEGORY_LABEL[c]}</option>
        ))}
      </SelectField>
      <TextAreaField label="Your complaint" name="message" required maxLength={3000} defaultValue={v.message} error={err.message} hint="Tell us what happened and what you would like us to do." />
      <SubmitButton className="w-full sm:w-auto" pendingText="Filing…">File complaint</SubmitButton>
    </form>
  );
}

export function TrackGrievanceForm({ ticket }: { ticket?: string }) {
  const [state, action] = useActionState<TrackGrievanceState, FormData>(trackGrievance, {});
  const r = state.result;
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4" noValidate>
        <FormError message={state.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Ticket number" name="ticket" required autoCapitalize="characters" placeholder="GRV-2026-000123" defaultValue={state.values?.ticket ?? ticket} />
          <TextField label="Email used for the complaint" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        </div>
        <SubmitButton variant="outline" className="w-full sm:w-auto" pendingText="Looking up…">Track complaint</SubmitButton>
      </form>
      {r && (
        <section aria-label={`Complaint ${r.ticket}`} className="rounded-2xl border border-ink-200 p-5" data-testid="grievance-status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-lg font-bold">{r.ticket}</p>
            <Badge tone={grievanceStatusTone(r.statusKey)}>{r.status}</Badge>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-500">About</dt><dd>{r.category}</dd>
            <dt className="text-ink-500">Received</dt><dd>{r.receivedAt}</dd>
            <dt className="text-ink-500">Acknowledged</dt><dd>{r.acknowledgedAt ?? `Due by ${r.acknowledgeBy}`}</dd>
            <dt className="text-ink-500">Resolved</dt><dd>{r.resolvedAt ?? `Due by ${r.resolveBy}`}</dd>
          </dl>
          {r.resolution && (
            <div className="mt-4 rounded-xl bg-mint-50 p-3 text-sm">
              <p className="font-semibold text-mint-700">Resolution</p>
              <p className="mt-1 whitespace-pre-line text-ink-900">{r.resolution}</p>
            </div>
          )}
          <h3 className="!mt-5 !mb-2 text-sm font-bold">History</h3>
          <ol className="space-y-3 text-sm">
            {r.events.map((e, i) => (
              <li key={e.id} className={cn("border-l-2 pl-3", i === r.events.length - 1 ? "border-brand-500" : "border-ink-200")}>
                <p className="whitespace-pre-line text-ink-900">{e.message}</p>
                <p className="text-xs text-ink-500">{e.at}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
