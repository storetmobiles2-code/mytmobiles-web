"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Check, Minus, Plus, ShoppingBag, Zap } from "lucide-react";
import { addToCart } from "@/app/actions/cart";
import { notifySessionChanged } from "@/components/layout/session-provider";
import { track } from "@/lib/analytics-client";
import { Price } from "@/components/ui/price";
import { cn } from "@/lib/cn";
import { ProductImage } from "./product-image";
import { WishlistButton } from "./wishlist-button";

export interface PanelVariant {
  id: string;
  sku: string;
  color: string | null;
  storage: string | null;
  ram: string | null;
  price: number;
  mrp: number;
  stock: number;
  maxPerOrder: number;
}

export interface PanelImage {
  url: string;
  alt: string;
  color: string | null;
}

const memKey = (v: PanelVariant) => [v.ram, v.storage].filter(Boolean).join(" + ");

export function PurchasePanel({ productId, name, variants, images, header, footer }: { productId: string; name: string; variants: PanelVariant[]; images: PanelImage[]; header?: ReactNode; footer?: ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const initial = useMemo(() => {
    const bySku = variants.find((v) => v.sku === params.get("variant"));
    return bySku ?? variants.find((v) => v.stock > 0) ?? variants[0];
  }, [variants, params]);
  const [selected, setSelected] = useState(initial);
  // Follow ?variant= changes (e.g. back/forward navigation) by adjusting state during render.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setSelected(initial);
  }
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    track("view_item", { productId, value: initial.price });
  }, [productId, initial.price]);

  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[];
  const mems = [...new Set(variants.map(memKey).filter(Boolean))];
  const forColor = (c: string | null) => variants.filter((v) => v.color === c);

  const choose = (v: PanelVariant | undefined) => {
    if (!v) return;
    setSelected(v);
    setQty(1);
    setMessage(null);
    setActiveImage(0);
    const p = new URLSearchParams(location.search);
    p.set("variant", v.sku);
    history.replaceState(null, "", `${location.pathname}?${p.toString()}`);
  };

  const pickColor = (c: string) => choose(forColor(c).find((v) => memKey(v) === memKey(selected)) ?? forColor(c).find((v) => v.stock > 0) ?? forColor(c)[0]);
  const pickMem = (m: string) => choose(variants.find((v) => memKey(v) === m && v.color === selected.color) ?? variants.find((v) => memKey(v) === m && v.stock > 0) ?? variants.find((v) => memKey(v) === m));

  const gallery = useMemo(() => {
    const own = images.filter((i) => i.color === selected.color);
    return own.length ? own : images.filter((i) => !i.color).length ? images.filter((i) => !i.color) : images;
  }, [images, selected.color]);

  const max = Math.max(1, Math.min(selected.stock, selected.maxPerOrder));
  const inStock = selected.stock > 0;

  const submit = (buyNow: boolean) =>
    start(async () => {
      const res = await addToCart(selected.id, qty);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      notifySessionChanged();
      track("add_to_cart", { productId, value: selected.price * qty });
      if (buyNow) router.push("/checkout");
      else setMessage({ ok: true, text: res.message ?? "Added to cart." });
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
      {/* Gallery */}
      <div className="lg:sticky lg:top-36 lg:self-start">
        <div className="card p-3 sm:p-5">
          <ProductImage image={gallery[activeImage] ?? null} name={name} priority sizes="(min-width:1024px) 45vw, 100vw" />
        </div>
        {gallery.length > 1 && (
          <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" aria-label="Product images">
            {gallery.map((img, i) => (
              <li key={img.url}>
                <button type="button" onClick={() => setActiveImage(i)} aria-label={`Show image ${i + 1}`} aria-current={i === activeImage} className={cn("relative block h-16 w-16 overflow-hidden rounded-xl border-2 bg-white", i === activeImage ? "border-brand-600" : "border-ink-200")}>
                  <Image src={img.url} alt="" fill sizes="64px" className="object-contain p-1" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Buy box */}
      <div className="space-y-5">
        {header}
        <div>
          <Price price={selected.price} mrp={selected.mrp} size="lg" />
          <p className="mt-1 text-xs text-ink-500">Inclusive of all taxes{selected.mrp > selected.price ? " · MRP as per brand" : ""}</p>
        </div>

        {colors.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink-700">
              Colour: <span className="font-normal text-ink-900">{selected.color}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => {
                const any = forColor(c).some((v) => v.stock > 0);
                return (
                  <button key={c} type="button" onClick={() => pickColor(c)} aria-pressed={selected.color === c} className={cn("rounded-xl border-2 px-3 py-2 text-sm font-medium", selected.color === c ? "border-brand-600 bg-brand-50 text-brand-800" : "border-ink-200 bg-white hover:border-ink-400", !any && "text-ink-400 line-through decoration-ink-300")}>
                    {c}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {mems.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink-700">Memory</legend>
            <div className="flex flex-wrap gap-2">
              {mems.map((m) => {
                const v = variants.find((x) => memKey(x) === m && x.color === selected.color);
                const available = variants.some((x) => memKey(x) === m && x.stock > 0);
                return (
                  <button key={m} type="button" onClick={() => pickMem(m)} aria-pressed={memKey(selected) === m} className={cn("rounded-xl border-2 px-3 py-2 text-left text-sm", memKey(selected) === m ? "border-brand-600 bg-brand-50" : "border-ink-200 bg-white hover:border-ink-400", !available && "opacity-60")}>
                    <span className="block font-semibold">{m}</span>
                    {v && <span className="block text-xs text-ink-500">₹{(v.price / 100).toLocaleString("en-IN")}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div aria-live="polite">
          {inStock ? (
            selected.stock <= 3 ? (
              <p className="text-sm font-semibold text-deal-700">Hurry — only {selected.stock} left in stock</p>
            ) : (
              <p className="text-sm font-semibold text-mint-700">In stock</p>
            )
          ) : (
            <p className="text-sm font-semibold text-danger-700">Out of stock{colors.length > 1 || mems.length > 1 ? " in this option — try another colour or memory" : ""}</p>
          )}
        </div>

        {inStock && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-ink-700" id="qty-label">Quantity</span>
            <div className="inline-flex items-center rounded-xl border border-ink-300" role="group" aria-labelledby="qty-label">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="grid h-10 w-10 place-items-center disabled:opacity-40" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
              <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} className="grid h-10 w-10 place-items-center disabled:opacity-40" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
            </div>
            {selected.maxPerOrder <= selected.stock && <span className="text-xs text-ink-500">Max {selected.maxPerOrder} per order</span>}
          </div>
        )}

        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:gap-3">
          <button type="button" disabled={!inStock || pending} onClick={() => submit(false)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-brand-600 bg-white font-bold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400">
            <ShoppingBag className="h-5 w-5 shrink-0" aria-hidden="true" /> <span className="whitespace-nowrap">Add to cart</span>
          </button>
          <button type="button" disabled={!inStock || pending} onClick={() => submit(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-300">
            <Zap className="h-5 w-5 shrink-0" aria-hidden="true" /> <span className="whitespace-nowrap">Buy now</span>
          </button>
          <WishlistButton productId={productId} productName={name} variant="button" />
        </div>
        {message && (
          <p role="status" className={cn("flex items-center gap-2 text-sm font-medium", message.ok ? "text-mint-700" : "text-danger-700")}>
            {message.ok && <Check className="h-4 w-4" aria-hidden="true" />}
            {message.text}
            {message.ok && <a href="/cart" className="ml-1 font-semibold text-brand-700 underline">View cart</a>}
          </p>
        )}
        {footer}
      </div>
    </div>
  );
}
