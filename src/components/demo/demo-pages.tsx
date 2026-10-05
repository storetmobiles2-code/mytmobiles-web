"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Eye, Heart, Minus, Phone, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import { computeTotals } from "@/lib/pricing";
import { formatINR } from "@/lib/money";
import { DEMO_NOTICE, demoCart, demoRemove, demoSetQty, demoWishlist, loadDemoData, type DemoCartItem, type DemoProduct } from "@/lib/demo";
import { notifySessionChanged, SESSION_CHANGED } from "@/components/layout/session-provider";
import { PriceSummary } from "@/components/cart/price-summary";
import { PincodeChecker } from "@/components/product/pincode-checker";
import { ProductGrid } from "@/components/product/product-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export interface DemoFees {
  shippingFee: number;
  freeShippingThreshold: number;
  codFee: number;
  supportPhone: string | null;
  supportEmail: string | null;
  address: string;
}

/** Thin bar on every page of the static preview. */
export function DemoBanner() {
  return (
    <div className="bg-brand-600 px-4 py-1.5 text-center text-xs font-semibold text-white">
      <Eye className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
      {DEMO_NOTICE}
    </div>
  );
}

function subscribe(onChange: () => void) {
  window.addEventListener(SESSION_CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SESSION_CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}
const cartSnapshot = () => JSON.stringify(demoCart());

/** Cart lines from localStorage; null until hydrated so the server HTML matches. */
function useDemoCart(): DemoCartItem[] | null {
  const raw = useSyncExternalStore(subscribe, cartSnapshot, () => "");
  return useMemo(() => (raw ? (JSON.parse(raw) as DemoCartItem[]) : null), [raw]);
}

function totalsFor(lines: DemoCartItem[], fees: DemoFees) {
  return computeTotals(
    lines.map((l) => ({ variantId: l.variantId, productId: l.productId, categoryId: "", brandId: "", unitPrice: l.price, mrp: l.mrp, quantity: l.qty, gstRateBps: 1800 })),
    fees,
  );
}

function Line({ line }: { line: DemoCartItem }) {
  const change = (qty: number) => {
    demoSetQty(line.variantId, qty);
    notifySessionChanged();
  };
  return (
    <li className="flex gap-4 py-5">
      <Link href={`/p/${line.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-ink-100 bg-white">
        {line.image && <Image src={line.image} alt="" fill sizes="96px" className="object-contain p-1.5" />}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/p/${line.slug}`} className="line-clamp-2 font-semibold hover:text-brand-700">{line.name}</Link>
        {line.option && <p className="mt-0.5 text-sm text-ink-500">{line.option}</p>}
        <p className="mt-1.5 flex items-baseline gap-2">
          <span className="font-bold tabular-nums">{formatINR(line.price)}</span>
          {line.mrp > line.price && <span className="text-sm text-ink-500 line-through tabular-nums">{formatINR(line.mrp)}</span>}
        </p>
        <div className="mt-3 flex items-center gap-4">
          <div className="inline-flex items-center rounded-xl border border-ink-300" role="group" aria-label={`Quantity of ${line.name}`}>
            <button type="button" onClick={() => change(line.qty - 1)} disabled={line.qty <= 1} className="grid h-9 w-9 place-items-center disabled:opacity-40" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
            <span className="w-8 text-center font-semibold tabular-nums">{line.qty}</span>
            <button type="button" onClick={() => change(line.qty + 1)} disabled={line.qty >= line.max} className="grid h-9 w-9 place-items-center disabled:opacity-40" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
          </div>
          <button
            type="button"
            onClick={() => {
              demoRemove(line.variantId);
              notifySessionChanged();
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-danger-700"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export function DemoCart({ fees }: { fees: DemoFees }) {
  const lines = useDemoCart();
  if (lines === null) return <div className="container-page min-h-[50vh] py-10" />;
  if (lines.length === 0) {
    return (
      <div className="container-page py-10">
        <EmptyState icon={<ShoppingBag className="h-7 w-7" />} title="Your cart is empty" action={<ButtonLink href="/">Start shopping</ButtonLink>}>
          Looks like you haven&apos;t added anything yet. Explore our latest mobiles and deals.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Your cart</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="card px-4 sm:px-6" aria-label="Cart items">
            <ul className="divide-y divide-ink-100">
              {lines.map((l) => (
                <Line key={l.variantId} line={l} />
              ))}
            </ul>
          </section>
          <div className="card p-4 sm:p-5">
            <PincodeChecker compact />
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <div className="card space-y-5 p-5">
            <PriceSummary totals={totalsFor(lines, fees)} />
            <ButtonLink href="/checkout" size="lg" className="w-full">Proceed to checkout</ButtonLink>
          </div>
          <p className="px-1 text-xs text-ink-500">Prices and availability are confirmed when you place the order.</p>
        </aside>
      </div>
    </div>
  );
}

/** Checkout in the preview explains how to buy today instead of taking an order. */
export function DemoCheckout({ fees }: { fees: DemoFees }) {
  const lines = useDemoCart();
  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card p-6 sm:p-8">
          <div className="inline-flex rounded-2xl bg-brand-50 p-3 text-brand-600"><Store className="h-7 w-7" aria-hidden="true" /></div>
          <h2 className="mt-4 text-xl font-extrabold">Online ordering opens soon</h2>
          <p className="mt-2 max-w-prose text-ink-700">
            You&apos;re looking at a preview of the myT Mobiles online store. When it launches you&apos;ll be able to pay here by UPI, card,
            net banking or Cash on Delivery, with a GST invoice for every order.
          </p>
          <p className="mt-3 max-w-prose text-ink-700">Until then, we&apos;re happy to help you buy anything you see here:</p>
          <ul className="mt-4 space-y-2 text-sm">
            {fees.supportPhone && (
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand-600" aria-hidden="true" /> Call or WhatsApp <a className="font-semibold underline" href={`tel:${fees.supportPhone}`}>{fees.supportPhone}</a></li>
            )}
            {fees.address && <li className="flex items-center gap-2"><Store className="h-4 w-4 text-brand-600" aria-hidden="true" /> Visit us at {fees.address}</li>}
            {!fees.supportPhone && !fees.address && (
              <li className="flex items-center gap-2"><Store className="h-4 w-4 text-brand-600" aria-hidden="true" /> Visit your nearest myT Mobiles store, or see <Link href="/contact" className="font-semibold underline">Contact us</Link>.</li>
            )}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/cart" variant="outline">Back to cart</ButtonLink>
            <ButtonLink href="/">Continue browsing</ButtonLink>
          </div>
        </section>
        {lines && lines.length > 0 && (
          <aside className="card space-y-4 p-5 lg:sticky lg:top-36 lg:self-start">
            <h2 className="text-sm font-bold tracking-wide text-ink-500 uppercase">Your selection</h2>
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={l.variantId} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0"><span className="line-clamp-1 font-medium">{l.name}</span><span className="text-ink-500">{l.option ? `${l.option} · ` : ""}Qty {l.qty}</span></span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatINR(l.price * l.qty)}</span>
                </li>
              ))}
            </ul>
            <PriceSummary totals={totalsFor(lines, fees)} title="Price details" />
          </aside>
        )}
      </div>
    </div>
  );
}

export function DemoWishlist() {
  const [products, setProducts] = useState<DemoProduct[] | null>(null);
  const ids = useSyncExternalStore(subscribe, () => demoWishlist().join(","), () => "");
  useEffect(() => {
    let live = true;
    void loadDemoData().then((d) => live && setProducts(d.products));
    return () => {
      live = false;
    };
  }, []);
  const saved = useMemo(() => {
    const wanted = ids.split(",").filter(Boolean);
    return (products ?? []).filter((p) => wanted.includes(p.id));
  }, [ids, products]);
  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Your wishlist</h1>
      <div className="mt-6">
        {products === null ? (
          <div className="min-h-[40vh]" />
        ) : saved.length ? (
          <ProductGrid products={saved} />
        ) : (
          <EmptyState icon={<Heart className="h-7 w-7" />} title="Your wishlist is empty" action={<ButtonLink href="/">Discover products</ButtonLink>}>Tap the heart on any product to save it here.</EmptyState>
        )}
      </div>
    </div>
  );
}
