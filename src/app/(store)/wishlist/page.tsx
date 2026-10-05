import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { cardSelect } from "@/lib/catalog/queries";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { DemoWishlist } from "@/components/demo/demo-pages";
import { DEMO } from "@/lib/demo";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  if (DEMO) return <DemoWishlist />;
  const user = await requireUser("/wishlist");
  const items = await db.wishlistItem.findMany({ where: { userId: user.id, product: { isActive: true } }, orderBy: { createdAt: "desc" }, include: { product: { select: cardSelect } } });
  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Your wishlist</h1>
      <div className="mt-6">
        {items.length ? (
          <ProductGrid products={items.map((i) => i.product)} />
        ) : (
          <EmptyState icon={<Heart className="h-7 w-7" />} title="Your wishlist is empty" action={<ButtonLink href="/">Discover products</ButtonLink>}>Tap the heart on any product to save it here.</EmptyState>
        )}
      </div>
    </div>
  );
}
