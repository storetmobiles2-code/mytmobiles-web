"use client";

import { useState, useTransition } from "react";
import { resendVerification } from "@/app/actions/auth";

export function ResendVerification() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (msg) return <span className="font-semibold">{msg}</span>;
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { const r = await resendVerification(); setMsg(r.success ?? r.error ?? null); })} className="font-semibold underline">
      {pending ? "Sending…" : "Resend verification email"}
    </button>
  );
}
