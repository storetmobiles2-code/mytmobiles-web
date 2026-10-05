import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { getCartView } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth/session";
import { CartLine } from "@/components/cart/cart-line";
import { CouponBox } from "@/components/cart/coupon-box";
import { PriceSummary } from "@/components/cart/price-summary";
import { PincodeChecker } from "@/components/product/pincode-checker";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { DemoCart } from "@/components/demo/demo-pages";
import { DEMO } from "@/lib/demo";
import { getPublicSettings } from "@/lib/public-data";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  if (DEMO) {
    const s = await getPublicSettings();
    return <DemoCart fees={{ shippingFee: s.shippingFee, freeShippingThreshold: s.freeShippingThreshold, codFee: s.codFee, supportPhone: s.supportPhone, supportEmail: s.supportEmail, address: s.address }} />;
  }
  const [cart, user] = await Promise.all([getCartView(), getCurrentUser()]);

  if (cart.lines.length === 0) {
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
              {cart.lines.map((l) => (
                <CartLine key={l.id} line={l} signedIn={Boolean(user)} />
              ))}
            </ul>
          </section>
          <div className="card p-4 sm:p-5">
            <PincodeChecker compact />
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <div className="card space-y-5 p-5">
            <CouponBox applied={cart.coupon} error={cart.couponError} />
            <PriceSummary totals={cart.totals} couponCode={cart.coupon?.code} />
            {cart.hasIssues ? (
              <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">Please fix the items marked above to continue.</p>
            ) : (
              <ButtonLink href={user ? "/checkout" : "/login?next=/checkout"} size="lg" className="w-full">
                {user ? "Proceed to checkout" : "Sign in to checkout"}
              </ButtonLink>
            )}
          </div>
          <p className="px-1 text-xs text-ink-500">Prices and availability are confirmed when you place the order.</p>
        </aside>
      </div>
    </div>
  );
}
