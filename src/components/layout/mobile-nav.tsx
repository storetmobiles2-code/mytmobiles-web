"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useSession } from "./session-provider";

export function MobileNav({ categories, brands, hasOpenBox }: { categories: { name: string; slug: string }[]; brands: { name: string; slug: string }[]; hasOpenBox: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const { session } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className="-ml-2 rounded-xl p-2 text-white hover:bg-white/10 lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => {
          ref.current?.showModal();
          setOpen(true);
        }}
      >
        <Menu className="h-6 w-6" />
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="m-0 h-dvh max-h-dvh w-[85vw] max-w-sm bg-white p-0 text-ink-900 backdrop:bg-ink-900/50"
        aria-label="Menu"
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <span className="font-bold">Menu</span>
          <button type="button" onClick={() => ref.current?.close()} className="rounded-lg p-2 hover:bg-ink-100" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="overflow-y-auto px-2 py-3" aria-label="Mobile">
          <Link href={session.user ? "/account" : "/login"} className="block rounded-lg px-3 py-2.5 font-semibold text-brand-700 hover:bg-brand-50">
            {session.user ? `Hi, ${session.user.name.split(" ")[0]}` : "Sign in / Create account"}
          </Link>
          {session.user?.role === "ADMIN" && (
            <Link href="/admin" className="block rounded-lg px-3 py-2.5 font-semibold hover:bg-ink-50">
              Admin dashboard
            </Link>
          )}
          <p className="mt-3 px-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Shop by category</p>
          {categories.map((c) => (
            <Link key={c.slug} href={`/c/${c.slug}`} className="block rounded-lg px-3 py-2.5 hover:bg-ink-50">
              {c.name}
            </Link>
          ))}
          {hasOpenBox && (
            <Link href="/open-box" className="block rounded-lg px-3 py-2.5 hover:bg-ink-50">
              Open-box deals
            </Link>
          )}
          <Link href="/offers" className="block rounded-lg px-3 py-2.5 hover:bg-ink-50">
            Offers & coupons
          </Link>
          <p className="mt-3 px-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Brands</p>
          <div className="flex flex-wrap gap-2 px-3 py-2">
            {brands.map((b) => (
              <Link key={b.slug} href={`/brands/${b.slug}`} className="rounded-full border border-ink-200 px-3 py-1 text-sm hover:border-brand-400">
                {b.name}
              </Link>
            ))}
          </div>
          <p className="mt-3 px-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Help</p>
          <Link href="/account/orders" className="block rounded-lg px-3 py-2.5 hover:bg-ink-50">Track orders</Link>
          <Link href="/wishlist" className="block rounded-lg px-3 py-2.5 hover:bg-ink-50">Wishlist</Link>
          <Link href="/help/shipping" className="block rounded-lg px-3 py-2.5 hover:bg-ink-50">Shipping & delivery</Link>
          <Link href="/help/returns" className="block rounded-lg px-3 py-2.5 hover:bg-ink-50">Returns & replacements</Link>
          <Link href="/contact" className="block rounded-lg px-3 py-2.5 hover:bg-ink-50">Contact us</Link>
        </nav>
      </dialog>
    </>
  );
}
