"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
      Print / Save as PDF
    </button>
  );
}
