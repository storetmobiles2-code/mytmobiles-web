"use client";

import { useActionState, useState } from "react";
import type { GrievanceStatus } from "@/generated/prisma/enums";
import { updateGrievanceAction } from "@/app/admin/actions/grievances";
import { GRIEVANCE_STATUSES, GRIEVANCE_STATUS_LABEL } from "@/lib/grievances/rules";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormError, FormSuccess } from "@/components/ui/field";

type R = { ok?: string; error?: string };

/** Status change and/or note. Public updates are emailed; resolving needs a resolution note. */
export function GrievanceUpdateForm({ grievanceId, status }: { grievanceId: string; status: GrievanceStatus }) {
  const [state, action] = useActionState<R, FormData>(updateGrievanceAction, {});
  const [next, setNext] = useState<GrievanceStatus>(status);
  const [internal, setInternal] = useState(false);
  const resolving = next === "RESOLVED" && status !== "RESOLVED";
  return (
    <form action={action} className="space-y-3">
      <FormSuccess message={state.ok} />
      <FormError message={state.error} />
      <input type="hidden" name="grievanceId" value={grievanceId} />
      <label className="block text-sm font-medium text-ink-700">
        Status
        <select name="status" value={next} onChange={(e) => setNext(e.target.value as GrievanceStatus)} disabled={internal} className="mt-1 h-10 w-full rounded-xl border border-ink-300 px-3 text-sm">
          {GRIEVANCE_STATUSES.map((s) => (
            <option key={s} value={s}>{GRIEVANCE_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </label>
      {internal && <input type="hidden" name="status" value={status} />}
      <label className="block text-sm font-medium text-ink-700">
        {internal ? "Internal note" : resolving ? "Resolution (emailed to the customer)" : "Note to the customer (emailed)"}
        <textarea name="note" required={resolving} maxLength={3000} className="mt-1 min-h-28 w-full rounded-xl border border-ink-300 p-3 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="internal" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Internal note only (not shown or emailed to the customer)
      </label>
      <SubmitButton className="w-full sm:w-auto" pendingText="Saving…">{internal ? "Add internal note" : "Save and notify customer"}</SubmitButton>
    </form>
  );
}
