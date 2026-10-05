import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getCartView } from "@/lib/cart";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { razorpayConfigured } from "@/lib/env";
import { estimateDelivery, formatDeliveryDate } from "@/lib/delivery";
import { formatINR } from "@/lib/money";
import { CheckoutClient } from "@/components/checkout/checkout-client";
import { PriceSummary } from "@/components/cart/price-summary";
import { CouponBox } from "@/components/cart/coupon-box";
import { ProductImage } from "@/components/product/product-image";
import { DemoCheckout } from "@/components/demo/demo-pages";
import { DEMO } from "@/lib/demo";
import { getPublicSettings } from "@/lib/public-data";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  if (DEMO) {
    const s = await getPublicSettings();
    return <DemoCheckout fees={{ shippingFee: s.shippingFee, freeShippingThreshold: s.freeShippingThreshold, codFee: s.codFee, supportPhone: s.supportPhone, supportEmail: s.supportEmail, address: s.address }} />;
  }
  const user = await requireUser("/checkout");
  const [cart, addresses, settings] = await Promise.all([
    getCartView(),
    db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] }),
    getSettings(),
  ]);
  if (cart.lines.length === 0) redirect("/cart");
  if (cart.hasIssues) redirect("/cart");

  const withDelivery = addresses.map((a) => {
    const est = estimateDelivery(a.pincode, a.state, settings);
    return {
      id: a.id, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state, pincode: a.pincode, type: a.type, isDefault: a.isDefault,
      delivery: { serviceable: est.serviceable, codAvailable: est.codAvailable, label: `${formatDeliveryDate(est.from)} – ${formatDeliveryDate(est.to)}` },
    };
  });

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <CheckoutClient
          addresses={withDelivery}
          total={cart.totals.total}
          codFee={settings.codFee}
          codMax={settings.codMaxOrderValue}
          codEnabled={settings.codEnabled}
          razorpayEnabled={razorpayConfigured()}
        />
        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-wide text-ink-500 uppercase">Order summary</h2>
              <Link href="/cart" className="text-sm font-semibold text-brand-700 hover:underline">Edit</Link>
            </div>
            <ul className="mt-3 divide-y divide-ink-100">
              {cart.lines.map((l) => (
                <li key={l.id} className="flex gap-3 py-3">
                  <div className="w-14 shrink-0"><ProductImage image={l.image} name={l.name} sizes="56px" /></div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="line-clamp-2 font-semibold">{l.name}</p>
                    {l.variantLabel && <p className="text-ink-500">{l.variantLabel}</p>}
                    <p className="text-ink-500">Qty {l.quantity} · <span className="font-semibold text-ink-900">{formatINR(l.unitPrice * l.quantity)}</span></p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card space-y-5 p-5">
            <CouponBox applied={cart.coupon} error={cart.couponError} />
            <PriceSummary totals={cart.totals} couponCode={cart.coupon?.code} />
            {settings.codFee > 0 && <p className="text-xs text-ink-500">A {formatINR(settings.codFee)} fee is added for Cash on Delivery.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
