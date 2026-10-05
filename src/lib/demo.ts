/**
 * Static preview build ("demo mode"), published to GitHub Pages.
 *
 * Built with NEXT_PUBLIC_DEMO=1 and NEXT_PUBLIC_BASE_PATH, then crawled into
 * static HTML by scripts/build-demo.ts. With no server behind it, the cart and
 * wishlist live in localStorage, search/filters run in the browser, and
 * checkout and accounts show a preview notice instead of taking orders.
 *
 * In normal builds DEMO is false and every demo branch is dead code.
 */
import type { ProductCardData } from "@/lib/catalog/queries";
import { estimateDelivery, formatDeliveryDate, PINCODE_PATTERN, type DeliverySettings } from "@/lib/delivery";
import { canonicalState } from "@/lib/indian-states";

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a root-relative path with the base path (for fetch(); Link and router add it themselves). */
export const withBase = (path: string) => (path.startsWith("/") && !path.startsWith(`${BASE_PATH}/`) ? `${BASE_PATH}${path}` : path);

export const DEMO_NOTICE = "This is a preview of the myT Mobiles online store. Online ordering opens soon.";

/* ── Snapshot data (/demo-data.json, generated at export time) ── */

export interface DemoSettings extends DeliverySettings {
  storeName: string;
  supportPhone: string | null;
  supportEmail: string | null;
  address: string;
  shippingFee: number;
  freeShippingThreshold: number;
  codFee: number;
}

export type DemoProduct = ProductCardData & { keywords: string[]; ram: number[]; storage: number[]; categorySlug: string; createdAt: string };

export interface DemoData {
  settings: DemoSettings;
  products: DemoProduct[];
}

let dataPromise: Promise<DemoData> | null = null;
export function loadDemoData(): Promise<DemoData> {
  dataPromise ??= fetch(withBase("/demo-data.json"))
    .then((r) => r.json() as Promise<DemoData>)
    .then((d) => ({ ...d, products: d.products.map((p) => ({ ...p, launchedAt: p.launchedAt ? new Date(p.launchedAt) : null })) }));
  return dataPromise;
}

/** Same matching rule as the live search: every word must appear in the name, brand or keywords. */
export function matchesQuery(p: Pick<DemoProduct, "name" | "keywords" | "brand">, q: string) {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  const hay = `${p.name} ${p.brand.name}`.toLowerCase();
  return tokens.every((t) => hay.includes(t) || p.keywords.includes(t));
}

/** Listing filters change the query string in place; DemoListing re-filters on this event. */
export const DEMO_FILTERS_EVENT = "myt:demo-filters";
export function demoNavigate(query: string) {
  history.pushState(null, "", query ? `${location.pathname}?${query}` : location.pathname);
  window.dispatchEvent(new Event(DEMO_FILTERS_EVENT));
}

/* ── Cart & wishlist in localStorage ── */

export interface DemoCartItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  option: string;
  image: string | null;
  price: number;
  mrp: number;
  qty: number;
  max: number;
}

const CART_KEY = "myt_demo_cart";
const WISHLIST_KEY = "myt_demo_wishlist";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const demoCart = () => read<DemoCartItem[]>(CART_KEY, []);

export function demoAddToCart(item: Omit<DemoCartItem, "qty">, qty: number): { ok: true; message: string } | { ok: false; error: string } {
  const cart = demoCart();
  const existing = cart.find((l) => l.variantId === item.variantId);
  const next = (existing?.qty ?? 0) + qty;
  if (next > item.max) return { ok: false, error: `You can buy up to ${item.max} of this item.` };
  if (existing) existing.qty = next;
  else cart.push({ ...item, qty });
  write(CART_KEY, cart);
  return { ok: true, message: "Added to cart." };
}

export function demoSetQty(variantId: string, qty: number) {
  write(
    CART_KEY,
    demoCart()
      .map((l) => (l.variantId === variantId ? { ...l, qty: Math.max(1, Math.min(l.max, qty)) } : l))
      .filter((l) => l.qty > 0),
  );
}
export const demoRemove = (variantId: string) => write(CART_KEY, demoCart().filter((l) => l.variantId !== variantId));

export const demoWishlist = () => read<string[]>(WISHLIST_KEY, []);
export function demoToggleWishlist(productId: string) {
  const list = demoWishlist();
  write(WISHLIST_KEY, list.includes(productId) ? list.filter((id) => id !== productId) : [...list, productId]);
}

/* ── Pincode check straight from the browser (India Post allows CORS) ── */

export async function demoPincode(code: string): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  if (!PINCODE_PATTERN.test(code)) return { ok: false, body: { error: "Enter a valid 6-digit pincode." } };
  const [{ settings }, info] = await Promise.all([
    loadDemoData(),
    fetch(`https://api.postalpincode.in/pincode/${code}`)
      .then((r) => r.json() as Promise<{ Status: string; PostOffice: { District: string; State: string; DeliveryStatus?: string }[] | null }[]>)
      .catch(() => null),
  ]);
  const offices = info?.[0]?.PostOffice ?? [];
  if (info && (info[0]?.Status !== "Success" || !offices.length)) return { ok: false, body: { error: `We couldn't find pincode ${code}. Please check and try again.` } };
  const primary = offices.find((o) => o.DeliveryStatus === "Delivery") ?? offices[0];
  const state = primary ? (canonicalState(primary.State) ?? primary.State) : null;
  const est = estimateDelivery(code, state, settings);
  return {
    ok: true,
    body: {
      pincode: code,
      city: primary?.District ?? null,
      state,
      serviceable: est.serviceable,
      codAvailable: est.codAvailable,
      estimate: est.serviceable ? { label: `${formatDeliveryDate(est.from)} – ${formatDeliveryDate(est.to)}` } : null,
    },
  };
}
