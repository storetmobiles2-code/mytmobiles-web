import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Product image with an honest placeholder: when no verified image exists for
 * a product we say so explicitly rather than showing a generic or wrong photo.
 */
export function ProductImage({
  image,
  name,
  sizes,
  priority = false,
  className,
}: {
  image: { url: string; alt: string } | null | undefined;
  name: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!image) {
    return (
      <div className={cn("flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl bg-ink-100 p-4 text-center", className)} role="img" aria-label={`${name} — product photo coming soon`}>
        <ImageOff className="h-7 w-7 text-ink-500" aria-hidden="true" />
        <span className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Photo coming soon</span>
        <span className="line-clamp-2 text-xs text-ink-500">{name}</span>
      </div>
    );
  }
  return (
    <div className={cn("relative aspect-square w-full overflow-hidden rounded-xl bg-white", className)}>
      <Image src={image.url} alt={image.alt} fill sizes={sizes} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} className="object-contain" />
    </div>
  );
}
