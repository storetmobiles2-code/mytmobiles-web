import Image from "next/image";
import Link from "next/link";
import logo from "../../../public/brand/myt-logo.png";

/**
 * Official myT Mobiles logo (white "my"/"MOBILES" with neon-pink "T").
 * The artwork is designed for dark backgrounds — place it on black/ink-950.
 */
/** `className` sets the display (default inline-flex), so responsive "hidden lg:inline-flex" isn't overridden. */
export function Logo({ className = "inline-flex", height = 44, priority = true }: { className?: string; height?: number; priority?: boolean }) {
  const width = Math.round((logo.width / logo.height) * height);
  return (
    <Link href="/" className={`shrink-0 items-center ${className}`} aria-label="myT Mobiles — home">
      <Image src={logo} alt="myT Mobiles" width={width} height={height} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} className="h-auto" style={{ height, width }} />
    </Link>
  );
}
