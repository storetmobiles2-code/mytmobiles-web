import Link from "next/link";
import { Badge, Rating } from "@/components/ui/misc";
import { Price } from "@/components/ui/price";
import type { ProductCardData } from "@/lib/catalog/queries";
import { ProductImage } from "./product-image";
import { WishlistButton } from "./wishlist-button";

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const colors = [...new Map(product.variants.filter((v) => v.color).map((v) => [v.color, v.colorHex])).keys()];
  const variantPrices = new Set(product.variants.map((v) => v.price));
  return (
    <article data-price={product.priceFrom} className="group card relative flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-pop)]">
      <div className="absolute top-3 right-3 z-10">
        <WishlistButton productId={product.id} productName={product.name} />
      </div>
      <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1">
        {product.condition === "DEMO" && <Badge tone="info">Demo unit</Badge>}
        {product.discountPct >= 10 && <Badge tone="deal">{product.discountPct}% off</Badge>}
      </div>
      <Link href={`/p/${product.slug}`} className="flex flex-1 flex-col p-3 pb-4 sm:p-4">
        <ProductImage
          image={product.images[0]}
          name={product.name}
          priority={priority}
          sizes="(min-width:1280px) 240px, (min-width:1024px) 22vw, (min-width:640px) 30vw, 46vw"
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="mt-3 flex flex-1 flex-col gap-1.5">
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{product.brand.name}</p>
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-ink-900 group-hover:text-brand-700 sm:text-[0.95rem]">{product.name}</h3>
          <Rating value={product.ratingAvg} count={product.ratingCount} />
          <div className="mt-auto pt-1">
            <Price price={product.priceFrom} mrp={product.mrpFrom} size="sm" from={variantPrices.size > 1} />
            {product.inStock ? (
              colors.length > 1 && <p className="mt-1 text-xs text-ink-500">{colors.length} colours</p>
            ) : (
              <p className="mt-1 text-xs font-semibold text-danger-700">Out of stock</p>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export function ProductRail({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {products.map((p) => (
        <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-[22%] xl:w-[18.5%]">
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
