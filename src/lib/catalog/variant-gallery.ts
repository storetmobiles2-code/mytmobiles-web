/**
 * Picks which product images to show for a selected variant colour.
 * Kept free of server-only imports so it's used by the client purchase panel
 * and tested directly.
 */
export interface GalleryPickImage {
  color: string | null;
}

/**
 * Images for this colour, if there are any; otherwise colourless images (images
 * that apply to every colour). Deliberately never falls back to another colour's
 * photos — that would show the shopper a different colour than the one they
 * picked. An empty result means the caller renders its "no photo yet" state.
 */
export function galleryForColor<T extends GalleryPickImage>(images: T[], color: string | null): T[] {
  const own = images.filter((i) => i.color === color);
  if (own.length) return own;
  return images.filter((i) => !i.color);
}
