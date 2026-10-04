"use client";

import { useFormStatus } from "react-dom";
import { Button, Spinner } from "@/components/ui/button";

export function SubmitButton({ children, pendingText, className = "w-full", variant = "primary", pending: forced }: { children: React.ReactNode; pendingText?: string; className?: string; variant?: "primary" | "secondary" | "outline" | "danger"; pending?: boolean }) {
  const status = useFormStatus();
  const pending = forced ?? status.pending;
  return (
    <Button type="submit" disabled={pending} className={className} variant={variant} aria-disabled={pending}>
      {pending && <Spinner />}
      {pending ? (pendingText ?? "Please wait…") : children}
    </Button>
  );
}
