/**
 * Downloads the official product images listed in catalog/reference.json,
 * optimises them for the web and records provenance.
 *
 *   npm run images:build            # process everything (cached downloads are reused)
 *   npm run images:build -- --sheets  # also write labelled contact sheets for visual QA
 *
 * Output
 *   public/images/products/<family-slug>/<colour-slug>-<n>.webp   1200×1200, white background
 *   catalog/images.lock.json   file → { source URL, page, credit, licence, dimensions }
 *
 * Images are trimmed of surrounding whitespace and centred on a square canvas
 * with padding — no other edits are made (no retouching, no watermark removal).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { slugify } from "../src/lib/slug";
import { contactSheet, download, optimise, SIZE } from "./lib/image-pipeline";

interface RefImage { url: string; credit: string; license: string }
interface RefFamily { brand: string; sourcePage: string; images: Record<string, RefImage[]>; skip?: Record<string, string> }
interface Reference { families: Record<string, RefFamily> }

export interface LockedImage {
  file: string;
  width: number;
  height: number;
  sourceUrl: string;
  sourcePage: string;
  credit: string;
  license: string;
}

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public/images/products");

export function familySlug(familyKey: string): string {
  const [brand, model] = familyKey.split("|");
  return slugify(`${brand} ${model}`);
}

async function main() {
  const withSheets = process.argv.includes("--sheets");
  const ref: Reference = JSON.parse(await fs.readFile(path.join(ROOT, "catalog/reference.json"), "utf8"));
  const lock: Record<string, Record<string, LockedImage[]>> = {};
  let ok = 0;
  let failed = 0;
  for (const [familyKey, fam] of Object.entries(ref.families)) {
    const slug = familySlug(familyKey);
    const sheet: { color: string; file: string }[] = [];
    for (const [color, images] of Object.entries(fam.images)) {
      if (color.startsWith("?")) continue; // unverified colour assignment — excluded until mapped
      let n = 0;
      for (const img of images) {
        try {
          const out = await optimise(await download(img.url));
          n++;
          const rel = `/images/products/${slug}/${slugify(color) || "default"}-${n}.webp`;
          await fs.mkdir(path.join(OUT, slug), { recursive: true });
          await fs.writeFile(path.join(ROOT, "public", rel), out);
          ((lock[familyKey] ??= {})[color] ??= []).push({
            file: rel,
            width: SIZE,
            height: SIZE,
            sourceUrl: img.url,
            sourcePage: fam.sourcePage,
            credit: img.credit,
            license: img.license,
          });
          sheet.push({ color, file: rel });
          ok++;
        } catch (err) {
          failed++;
          console.error(`✗ ${familyKey} / ${color}: ${(err as Error).message}`);
        }
      }
    }
    if (withSheets && sheet.length) await contactSheet(familySlug(familyKey), sheet);
  }
  await fs.writeFile(path.join(ROOT, "catalog/images.lock.json"), JSON.stringify(lock, null, 2) + "\n");
  console.log(`✓ ${ok} images written, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main();
