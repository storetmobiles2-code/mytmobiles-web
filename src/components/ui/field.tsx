import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-xl border bg-white px-3.5 py-2.5 text-ink-900 placeholder:text-ink-500 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-ink-100";

interface FieldProps {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
}

function Wrapper({ id, label, error, hint, optional, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-700">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-500">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const TextField = forwardRef<HTMLInputElement, FieldProps & InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { label, error, hint, optional, className, id, ...props },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Wrapper id={fid} label={label} error={error} hint={hint} optional={optional}>
      <input
        ref={ref}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        className={cn(control, error ? "border-danger-600" : "border-ink-300 focus:border-brand-500", className)}
        {...props}
      />
    </Wrapper>
  );
});

export const SelectField = forwardRef<HTMLSelectElement, FieldProps & SelectHTMLAttributes<HTMLSelectElement>>(function SelectField(
  { label, error, hint, optional, className, id, children, ...props },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Wrapper id={fid} label={label} error={error} hint={hint} optional={optional}>
      <select
        ref={ref}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : undefined}
        className={cn(control, "appearance-auto", error ? "border-danger-600" : "border-ink-300 focus:border-brand-500", className)}
        {...props}
      >
        {children}
      </select>
    </Wrapper>
  );
});

export const TextAreaField = forwardRef<HTMLTextAreaElement, FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextAreaField(
  { label, error, hint, optional, className, id, ...props },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Wrapper id={fid} label={label} error={error} hint={hint} optional={optional}>
      <textarea
        ref={ref}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : undefined}
        className={cn(control, "min-h-28", error ? "border-danger-600" : "border-ink-300 focus:border-brand-500", className)}
        {...props}
      />
    </Wrapper>
  );
});

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700">
      {message}
    </div>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="rounded-xl border border-mint-600/30 bg-mint-50 px-4 py-3 text-sm text-mint-700">
      {message}
    </div>
  );
}
