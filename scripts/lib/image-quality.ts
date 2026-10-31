/**
 * Automatic checks on an official product image, run on the downloaded source
 * before it is trimmed and padded. Trimming hides problems such as a product cut
 * off at the edge of the brand's picture, so they are measured here instead.
 *
 * The checks flag images for a person (or the image-curator agent) to look at.
 * Only clear-cut problems block an image outright (see blockingIssues). "cropped"
 * is a flag, not a block: a brand's tightly trimmed picture also touches its edges. They can't see a product
 * clipped inside the brand's own picture (a close-up that ends in a straight
 * line), text-heavy marketing panels or several devices in one shot: those need
 * the contact-sheet review in store-rules.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export type ImageIssue = "cropped" | "full-bleed" | "low-res" | "tiny-source";

export interface ImageAssessment {
  /** Source size in pixels */
  width: number;
  height: number;
  /** Long side of the product (non-white area) in source pixels */
  productPx: number;
  /** Share of each source edge covered by the product: top, right, bottom, left */
  edges: [number, number, number, number];
  issues: ImageIssue[];
}

/** Gallery views that may legitimately show only part of the product, or a scene. */
export const PARTIAL_VIEWS = new Set(["detail", "lifestyle", "box"]);

/** Edge cover above which the product is cut off by that edge (a tight crop touches only at a few points). */
const CUT = 0.18;
/** Edge cover on all four sides that means a photo with its own background, not a cut-out product shot. */
const BLEED = 0.6;
/** Long side of the product, in source pixels, below which it is enlarged to fill the 1080 px gallery frame. */
const SOFT_PX = 700;
const TINY_PX = 400;

export async function assessImage(input: Buffer): Promise<ImageAssessment> {
  const { data, info } = await sharp(input).flatten({ background: "#ffffff" }).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const isProduct = (x: number, y: number) => data[y * w + x] < 235;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (isProduct(x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  const productPx = maxX < 0 ? 0 : Math.max(maxX - minX + 1, maxY - minY + 1);

  // Cover of each edge, read 2 px in so anti-aliased borders don't count.
  const cover = (pts: [number, number][]) => pts.filter(([x, y]) => isProduct(x, y)).length / pts.length;
  const row = (y: number) => Array.from({ length: w }, (_, x) => [x, y] as [number, number]);
  const col = (x: number) => Array.from({ length: h }, (_, y) => [x, y] as [number, number]);
  const edges: ImageAssessment["edges"] = [cover(row(Math.min(1, h - 1))), cover(col(Math.max(w - 2, 0))), cover(row(Math.max(h - 2, 0))), cover(col(Math.min(1, w - 1)))];

  const issues: ImageIssue[] = [];
  if (edges.every((e) => e >= BLEED)) issues.push("full-bleed");
  else if (isCut(edges)) issues.push("cropped");
  if (productPx < TINY_PX) issues.push("tiny-source");
  else if (productPx < SOFT_PX) issues.push("low-res");
  return { width: w, height: h, productPx, edges, issues };
}

/**
 * A product trimmed tight by the brand fills the picture along one axis and touches two opposite
 * edges (top and bottom, or left and right). One edge, two neighbouring edges or three mean the
 * product, or the banner it sits on, runs out of the picture.
 */
function isCut([top, right, bottom, left]: ImageAssessment["edges"]): boolean {
  const touched = [top, right, bottom, left].map((e) => e >= CUT);
  const n = touched.filter(Boolean).length;
  if (n === 0) return false;
  const opposite = (touched[0] && touched[2] && !touched[1] && !touched[3]) || (touched[1] && touched[3] && !touched[0] && !touched[2]);
  return !opposite;
}

/**
 * Problems that keep an image out of the gallery without review: a source too small to use, and
 * a photo with its own background in a slot meant for the product itself (front, back, sides,
 * angles). Everything else is flagged for the contact-sheet review.
 */
export function blockingIssues(a: ImageAssessment, view: string | null | undefined): ImageIssue[] {
  const partialOk = view ? PARTIAL_VIEWS.has(view) : false;
  return a.issues.filter((i) => i === "tiny-source" || (!partialOk && i === "full-bleed"));
}

export const ISSUE_TEXT: Record<ImageIssue, string> = {
  cropped: "product is cut off by the edge of the brand's picture",
  "full-bleed": "a photo with its own background, not a cut-out product shot",
  "low-res": "small source: it is enlarged and will look soft",
  "tiny-source": "source too small to use",
};

/**
 * Images reviewed and rejected (catalog/images.rejected.json: source URL → reason). The image
 * builds skip them, so an image taken out of a gallery isn't added back by a later edit.
 */
export function readRejected(root: string): Map<string, string> {
  const file = path.join(root, "catalog/images.rejected.json");
  if (!fs.existsSync(file)) return new Map();
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as { images: Record<string, { reason: string }> };
  return new Map(Object.entries(data.images).map(([url, r]) => [url, r.reason]));
}
