/**
 * Gallery image filenames are `<colour>-<n>-<fingerprint>.webp` (older builds: `<colour>-<n>.webp`).
 * Banners, categories and order items keep a copy of a product image's path. When a rebuild
 * renames or reorders a colour's images, those copies point at a file that no longer exists.
 */
// Fingerprinted names are tried first: a fingerprint can be all digits ("00000000"), which the
// older pattern would misread as the position.
const FINGERPRINTED = /^(.+)-(\d+)-[0-9a-f]{8}\.webp$/;
const NUMBERED = /^(.+)-(\d+)\.webp$/;

/** The colour part and position of a gallery filename, or null for anything else (360° frames, uploads). */
export function parseGalleryName(file: string): { colour: string; position: number } | null {
  const m = FINGERPRINTED.exec(file) ?? NUMBERED.exec(file);
  return m ? { colour: m[1], position: Number(m[2]) } : null;
}

/**
 * The current path for a stale copy: the first image of the same colour in the same folder,
 * which is what a banner or an order snapshot shows. Null when that colour has no image any
 * more; a different colour's photo would misrepresent what was shown or ordered.
 */
export function repointStaleImage(url: string, filesInFolder: string[]): string | null {
  const slash = url.lastIndexOf("/");
  const folder = url.slice(0, slash + 1);
  const wanted = parseGalleryName(url.slice(slash + 1));
  if (!wanted) return null;
  const sameColour = filesInFolder
    .map((f) => ({ f, p: parseGalleryName(f) }))
    .filter((x): x is { f: string; p: NonNullable<typeof x.p> } => x.p?.colour === wanted.colour)
    .sort((a, b) => a.p.position - b.p.position);
  return sameColour.length ? folder + sameColour[0].f : null;
}
