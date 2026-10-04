"use client";

import Link from "next/link";
import { Heart, ShoppingBag, User } from "lucide-react";
import { useSession } from "./session-provider";

export function HeaderActions() {
  const { session, loaded } = useSession();
  const first = session.user?.name.split(" ")[0];
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link
        href={session.user ? (session.user.role === "ADMIN" ? "/admin" : "/account") : "/login"}
        className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 sm:inline-flex"
      >
        <User className="h-5 w-5" aria-hidden="true" />
        <span className="max-w-24 truncate">{loaded ? (first ? first : "Sign in") : <span className="inline-block h-4 w-12" />}</span>
      </Link>
      <Link href="/wishlist" className="relative hidden rounded-xl p-2.5 text-white/90 hover:bg-white/10 sm:inline-flex" aria-label={`Wishlist${session.wishlist.length ? `, ${session.wishlist.length} items` : ""}`}>
        <Heart className="h-5 w-5" aria-hidden="true" />
        {session.wishlist.length > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand-500" />}
      </Link>
      <Link href="/cart" className="relative inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700" aria-label={`Cart, ${session.cartCount} items`}>
        <ShoppingBag className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">Cart</span>
        {session.cartCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-xs font-bold text-brand-700 tabular-nums" aria-hidden="true">
            {session.cartCount > 99 ? "99+" : session.cartCount}
          </span>
        )}
      </Link>
    </div>
  );
}
