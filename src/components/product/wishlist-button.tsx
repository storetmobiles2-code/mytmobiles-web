"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleWishlist } from "@/app/actions/wishlist";
import { notifySessionChanged, useSession } from "@/components/layout/session-provider";
import { cn } from "@/lib/cn";
import { DEMO, demoToggleWishlist } from "@/lib/demo";

export function WishlistButton({ productId, productName, variant = "icon" }: { productId: string; productName: string; variant?: "icon" | "button" }) {
  const { session } = useSession();
  const router = useRouter();
  const [pending, start] = useTransition();
  const saved = session.wishlist.includes(productId);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (DEMO) {
      demoToggleWishlist(productId);
      notifySessionChanged();
      return;
    }
    start(async () => {
      const res = await toggleWishlist(productId);
      if (!res.ok && res.reason === "auth") router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      else notifySessionChanged();
    });
  };

  if (variant === "button") {
    return (
      <button type="button" onClick={onClick} disabled={pending} aria-pressed={saved} aria-label={saved ? "Remove from wishlist" : "Save to wishlist"} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-ink-300 bg-white px-3.5 font-semibold text-ink-900 hover:bg-ink-50 sm:px-4">
        <Heart className={cn("h-5 w-5", saved && "fill-brand-500 text-brand-500")} aria-hidden="true" />
        <span className="hidden sm:inline">{saved ? "Saved" : "Wishlist"}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink-500 shadow-sm ring-1 ring-ink-200 transition hover:text-brand-600"
    >
      <Heart className={cn("h-[18px] w-[18px]", saved && "fill-brand-500 text-brand-500")} aria-hidden="true" />
    </button>
  );
}
