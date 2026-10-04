"use client";

import { useState } from "react";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {}
      }}
      className="mt-3 inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-brand-300 px-3 py-1.5 font-mono text-sm font-bold text-brand-700 hover:bg-brand-50"
      aria-label={`Copy coupon code ${code}`}
    >
      {code} <span className="font-sans text-xs font-semibold text-ink-500">{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
}
