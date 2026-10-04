import { AirVent, Headphones, Laptop, Printer, Smartphone, Tablet, Tv, Watch, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  smartphones: Smartphone,
  tablets: Tablet,
  "smart-tvs": Tv,
  "air-coolers": AirVent,
  audio: Headphones,
  smartwatches: Watch,
  laptops: Laptop,
  printers: Printer,
};

export function CategoryIcon({ slug, className = "h-7 w-7" }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? Smartphone;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.6} />;
}
