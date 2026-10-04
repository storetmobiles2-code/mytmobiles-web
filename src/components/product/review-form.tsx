"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReview } from "@/app/actions/account";
import type { FormState } from "@/app/actions/auth";
import { FormError, FormSuccess, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";

export function ReviewForm({ productId, existing }: { productId: string; existing?: { rating: number; title: string; body: string } }) {
  const [state, action] = useActionState<FormState, FormData>(submitReview, {});
  const [rating, setRating] = useState(existing?.rating ?? 0);
  if (state.success) return <FormSuccess message={state.success} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <FormError message={state.error} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink-700">Your rating</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className="rounded p-1">
              <Star className={`h-8 w-8 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-ink-300"}`} aria-hidden="true" />
            </button>
          ))}
        </div>
        {state.fieldErrors?.rating && <p className="mt-1 text-sm text-danger-700">{state.fieldErrors.rating}</p>}
      </fieldset>
      <TextField label="Title" name="title" defaultValue={state.values?.title ?? existing?.title} maxLength={100} required error={state.fieldErrors?.title} />
      <TextAreaField label="Your review" name="body" defaultValue={state.values?.body ?? existing?.body} maxLength={2000} required error={state.fieldErrors?.body} hint="What did you like or dislike? How's the battery, camera, build?" />
      <SubmitButton className="w-full sm:w-auto" pendingText="Submitting…">Submit review</SubmitButton>
    </form>
  );
}
