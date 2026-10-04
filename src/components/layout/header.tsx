import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { getNavData, getPublicSettings } from "@/lib/public-data";
import { formatINR } from "@/lib/money";
import { HeaderActions } from "./header-actions";
import { MobileNav } from "./mobile-nav";
import { SearchBox } from "./search-box";

export async function Header() {
  const [{ categories, brands, hasOpenBox }, settings] = await Promise.all([getNavData(), getPublicSettings()]);
  const perks = [
    settings.freeShippingThreshold > 0 ? `Free delivery on orders above ${formatINR(settings.freeShippingThreshold)}` : "Free delivery on all orders",
    settings.codEnabled ? "Cash on Delivery available" : null,
    "GST invoice on every order",
  ].filter(Boolean);
  return (
    <header className="sticky top-0 z-40 bg-brand-950 text-white shadow-[0_1px_0_rgb(255_255_255/0.06)]">
      <div className="hidden border-b border-white/10 text-xs text-white/70 sm:block">
        <div className="container-page flex h-8 items-center justify-center gap-6">
          {perks.map((p) => (
            <span key={p} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />{p}</span>
          ))}
        </div>
      </div>
      <div className="container-page flex h-16 items-center gap-3 lg:h-[72px] lg:gap-6">
        <MobileNav categories={categories} brands={brands} hasOpenBox={hasOpenBox} />
        <Logo height={40} className="lg:hidden" />
        <Logo height={50} className="hidden lg:inline-flex" />
        <Suspense fallback={<div className="hidden h-11 flex-1 md:block" />}>
          <SearchBox className="hidden flex-1 md:block" />
        </Suspense>
        <div className="ml-auto md:ml-0">
          <HeaderActions />
        </div>
      </div>
      <div className="container-page pb-3 md:hidden">
        <Suspense fallback={<div className="h-11" />}>
          <SearchBox />
        </Suspense>
      </div>
      <nav aria-label="Categories" className="hidden border-t border-white/10 lg:block">
        <ul className="container-page flex h-11 items-center gap-1 text-sm font-medium text-white/80">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/c/${c.slug}`} className="rounded-lg px-3 py-2 hover:bg-white/10 hover:text-white">
                {c.name}
              </Link>
            </li>
          ))}
          {hasOpenBox && (
            <li>
              <Link href="/open-box" className="rounded-lg px-3 py-2 hover:bg-white/10 hover:text-white">
                Open-box deals
              </Link>
            </li>
          )}
          <li className="ml-auto">
            <Link href="/offers" className="rounded-lg px-3 py-2 font-semibold text-brand-400 hover:bg-white/10">
              Offers
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
