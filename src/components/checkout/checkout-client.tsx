"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Banknote, CreditCard, MapPin, Plus, ShieldCheck } from "lucide-react";
import { placeOrderAction, reportPaymentFailureAction, verifyPaymentAction, type RazorpayLaunch } from "@/app/actions/orders";
import { AddressForm } from "@/components/account/address-form";
import { notifySessionChanged } from "@/components/layout/session-provider";
import { FormError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { track } from "@/lib/analytics-client";
import { cn } from "@/lib/cn";
import { openRazorpay } from "./razorpay";

export interface CheckoutAddress {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  type: string;
  isDefault: boolean;
  delivery: { serviceable: boolean; codAvailable: boolean; label: string };
}

export function CheckoutClient({
  addresses,
  total,
  codFee,
  codMax,
  codEnabled,
  razorpayEnabled,
}: {
  addresses: CheckoutAddress[];
  total: number;
  codFee: number;
  codMax: number;
  codEnabled: boolean;
  razorpayEnabled: boolean;
}) {
  const router = useRouter();
  const [addressId, setAddressId] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "");
  const [adding, setAdding] = useState(addresses.length === 0);
  const [method, setMethod] = useState<"COD" | "RAZORPAY" | "">("");
  const [gst, setGst] = useState({ open: false, gstin: "", company: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // One idempotency key per checkout attempt: double-clicks can't create two orders.
  const [idempotencyKey, setKey] = useState(() => crypto.randomUUID());

  const selected = addresses.find((a) => a.id === addressId);
  const codAllowed = codEnabled && Boolean(selected?.delivery.codAvailable) && total + codFee <= codMax;
  const codReason = !codEnabled ? "Not offered right now" : !selected ? "Select an address first" : !selected.delivery.codAvailable ? "Not available for this pincode" : total + codFee > codMax ? `Available on orders up to ${formatINR(codMax)}` : null;
  const effectiveMethod = method === "COD" && !codAllowed ? "" : method;
  const payable = total + (effectiveMethod === "COD" ? codFee : 0);

  const onSaved = useCallback(
    (id: string) => {
      setAdding(false);
      setAddressId(id);
      router.refresh();
    },
    [router],
  );

  const pay = async (launch: RazorpayLaunch) => {
    const outcome = await openRazorpay(launch);
    if (outcome.status === "paid") {
      const v = await verifyPaymentAction({ orderId: launch.orderId, ...outcome.response });
      if (!v.ok) {
        setError(v.error);
        router.push(`/account/orders/${launch.orderId}`);
        return;
      }
      notifySessionChanged();
      router.push(`/order-confirmation/${launch.orderId}`);
      return;
    }
    if (outcome.status === "failed") void reportPaymentFailureAction({ razorpayOrderId: launch.razorpayOrderId, reason: outcome.reason });
    setNotice(
      outcome.status === "failed"
        ? `Payment failed: ${outcome.reason}. Your items are reserved for a short while — you can retry from your order page.`
        : "Payment was not completed. Your items are reserved for a short while — you can complete payment from your order page.",
    );
    router.push(`/account/orders/${launch.orderId}?payment=incomplete`);
  };

  const placeOrder = () =>
    start(async () => {
      setError(null);
      setNotice(null);
      if (!selected) return setError("Please add and select a delivery address.");
      if (!selected.delivery.serviceable) return setError(`We don't deliver to ${selected.pincode} yet. Choose another address.`);
      if (!effectiveMethod) return setError("Please choose a payment method.");
      track("begin_checkout", { value: payable });
      const res = await placeOrderAction({ addressId, paymentMethod: effectiveMethod, idempotencyKey, buyerGstin: gst.open ? gst.gstin : "", buyerCompany: gst.open ? gst.company : "" });
      if (!res.ok) {
        setError(res.error);
        setKey(crypto.randomUUID());
        return;
      }
      if (res.next === "confirmation") {
        notifySessionChanged();
        router.push(`/order-confirmation/${res.orderId}`);
      } else await pay(res.razorpay);
    });

  const methods = useMemo(
    () => [
      { id: "RAZORPAY" as const, enabled: razorpayEnabled, icon: CreditCard, title: "Pay online", desc: razorpayEnabled ? "UPI, cards, net banking & wallets via Razorpay" : "Temporarily unavailable" },
      { id: "COD" as const, enabled: codAllowed, icon: Banknote, title: "Cash on Delivery", desc: codAllowed ? (codFee > 0 ? `${formatINR(codFee)} COD fee applies` : "Pay in cash or UPI when your order arrives") : (codReason ?? "") },
    ],
    [razorpayEnabled, codAllowed, codFee, codReason],
  );

  return (
    <div className="space-y-4">
      <section className="card p-5" aria-labelledby="addr">
        <h2 id="addr" className="flex items-center gap-2 text-lg font-bold"><MapPin className="h-5 w-5 text-brand-600" aria-hidden="true" />Delivery address</h2>
        {addresses.length > 0 && (
          <fieldset className="mt-4 space-y-2">
            <legend className="sr-only">Choose address</legend>
            {addresses.map((a) => (
              <label key={a.id} className={cn("flex cursor-pointer gap-3 rounded-xl border-2 p-3.5", a.id === addressId ? "border-brand-600 bg-brand-50/40" : "border-ink-200 hover:border-ink-300")}>
                <input type="radio" name="address" value={a.id} checked={a.id === addressId} onChange={() => setAddressId(a.id)} className="mt-1 h-4 w-4 accent-brand-600" />
                <span className="min-w-0 text-sm">
                  <span className="font-semibold text-ink-900">{a.fullName}</span>
                  <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-bold text-ink-500">{a.type}</span>
                  <span className="block text-ink-700">{[a.line1, a.line2, a.landmark, a.city, `${a.state} ${a.pincode}`].filter(Boolean).join(", ")}</span>
                  <span className="block text-ink-500">Mobile: {a.phone}</span>
                  <span className={cn("mt-1 block font-semibold", a.delivery.serviceable ? "text-mint-700" : "text-danger-700")}>{a.delivery.serviceable ? `Delivery by ${a.delivery.label}` : "Not deliverable to this pincode"}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {adding ? (
          <div className="mt-4 rounded-xl border border-ink-200 p-4">
            <AddressForm onSaved={onSaved} onCancel={addresses.length ? () => setAdding(false) : undefined} submitLabel="Save and deliver here" />
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a new address
          </button>
        )}
      </section>

      <section className="card p-5" aria-labelledby="pay">
        <h2 id="pay" className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />Payment method</h2>
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Choose payment method</legend>
          {methods.map((m) => (
            <label key={m.id} className={cn("flex gap-3 rounded-xl border-2 p-3.5", !m.enabled ? "cursor-not-allowed border-ink-100 opacity-60" : effectiveMethod === m.id ? "cursor-pointer border-brand-600 bg-brand-50/40" : "cursor-pointer border-ink-200 hover:border-ink-300")}>
              <input type="radio" name="method" value={m.id} disabled={!m.enabled} checked={effectiveMethod === m.id} onChange={() => setMethod(m.id)} className="mt-1 h-4 w-4 accent-brand-600" />
              <m.icon className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden="true" />
              <span className="text-sm">
                <span className="block font-semibold text-ink-900">{m.title}</span>
                <span className="block text-ink-500">{m.desc}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-4 border-t border-ink-100 pt-4">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink-700">
            <input type="checkbox" checked={gst.open} onChange={(e) => setGst({ ...gst, open: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            Use GSTIN for a business invoice (claim input tax credit)
          </label>
          {gst.open && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-ink-700">GSTIN</span>
                <input value={gst.gstin} onChange={(e) => setGst({ ...gst, gstin: e.target.value.toUpperCase().slice(0, 15) })} placeholder="15-character GSTIN" className="h-10 w-full rounded-xl border border-ink-300 px-3 uppercase" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-ink-700">Business name</span>
                <input value={gst.company} onChange={(e) => setGst({ ...gst, company: e.target.value.slice(0, 120) })} placeholder="As registered on GST" className="h-10 w-full rounded-xl border border-ink-300 px-3" />
              </label>
            </div>
          )}
        </div>
      </section>

      <div className="card space-y-3 p-5">
        <FormError message={error} />
        {notice && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</p>}
        <button type="button" onClick={placeOrder} disabled={pending} className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-base font-bold text-white hover:bg-brand-700 disabled:opacity-60">
          {pending && <Spinner className="h-5 w-5" />}
          {pending ? "Placing order…" : effectiveMethod === "RAZORPAY" ? `Pay ${formatINR(payable)}` : `Place order · ${formatINR(payable)}`}
        </button>
        <p className="text-center text-xs text-ink-500">By placing this order you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/help/returns" className="underline">Returns policy</Link>.</p>
      </div>
    </div>
  );
}
