import Image from "next/image";
import Link from "next/link";
import logo from "../../../public/brand/myt-logo.png";

/**
 * Official myT Mobiles logo (white "my"/"MOBILES" with neon-pink "T").
 * The artwork is designed for dark backgrounds — place it on black/ink-950.
 */
export function Logo({ className = "", height = 44, priority = true }: { className?: string; height?: number; priority?: boolean }) {
  const width = Math.round((logo.width / logo.height) * height);
  return (
    <Link href="/" className={`inline-flex shrink-0 items-center ${className}`} aria-label="myT Mobiles — home">
      <Image src={logo} alt="myT Mobiles" width={width} height={height} priority={priority} className="h-auto" style={{ height, width }} />
    </Link>
  );
}
