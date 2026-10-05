/**
 * next/image loader for the static preview: there is no optimiser, so return the
 * file itself (product images are already 1200px WebP). Root-relative paths get
 * the base path, which next/image doesn't add for string sources.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function demoImageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  const url = src.startsWith("/") && !src.startsWith(`${BASE}/`) ? `${BASE}${src}` : src;
  // The width param keeps next/image's srcset entries distinct; static hosts ignore it.
  return `${url}${url.includes("?") ? "&" : "?"}w=${width}`;
}
