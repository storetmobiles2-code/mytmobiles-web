"use client";

import { useEffect, useState } from "react";
import { MapPin, Truck } from "lucide-react";

interface Result {
  pincode: string;
  city: string | null;
  state: string | null;
  serviceable: boolean;
  codAvailable: boolean;
  estimate: { label: string } | null;
}

const KEY = "myt_pincode";

export function PincodeChecker({ compact = false }: { compact?: boolean }) {
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function check(code: string) {
    if (!/^[1-9][0-9]{5}$/.test(code)) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pincode/${code}`);
      const body = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(body.error ?? "Couldn't check this pincode.");
      } else {
        setResult(body);
        try {
          localStorage.setItem(KEY, code);
        } catch {}
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        // Restoring the last pincode from localStorage can only happen after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPin(saved);
        void check(saved);
      }
    } catch {}
  }, []);

  return (
    <div className={compact ? "" : "rounded-2xl border border-ink-200 p-4"}>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
        <MapPin className="h-4 w-4 text-brand-600" aria-hidden="true" /> Check delivery
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void check(pin);
        }}
      >
        <label htmlFor="pdp-pin" className="sr-only">Pincode</label>
        <input
          id="pdp-pin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Enter pincode"
          className="h-10 w-full rounded-xl border border-ink-300 px-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none"
        />
        <button className="h-10 shrink-0 rounded-xl border border-brand-600 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50" disabled={loading}>
          {loading ? "Checking…" : "Check"}
        </button>
      </form>
      <div aria-live="polite" className="mt-2 text-sm">
        {error && <p className="text-danger-700">{error}</p>}
        {result &&
          (result.serviceable ? (
            <div className="space-y-1 text-ink-700">
              <p className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" aria-hidden="true" />
                <span>
                  Delivery by <strong className="text-ink-900">{result.estimate?.label}</strong>
                  {result.city && <span className="text-ink-500"> · {result.city}{result.state ? `, ${result.state}` : ""}</span>}
                </span>
              </p>
              <p className={result.codAvailable ? "text-mint-700" : "text-ink-500"}>{result.codAvailable ? "✓ Cash on Delivery available" : "Cash on Delivery not available — pay online"}</p>
            </div>
          ) : (
            <p className="text-danger-700">Sorry, we don&apos;t deliver to {result.pincode} yet.</p>
          ))}
      </div>
    </div>
  );
}
