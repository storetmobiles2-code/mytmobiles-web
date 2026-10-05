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
import { contactSheet, download, optimise, optimiseSpinFrame, pool, SIZE, SPIN_SIZE } from "./lib/image-pipeline";

export interface LockedSpin {
  frames: string[];
  width: number;
  height: number;
  sourcePage: string;
  credit: string;
  license: string;
}

interface RefImage { url: string; view?: string; sourcePage?: string; credit: string; license: string }
interface RefSpin { frames: string[]; sourcePage?: string; credit: string; license: string }
interface RefFamily { brand: string; sourcePage: string; images: Record<string, RefImage[]>; spins?: Record<string, RefSpin>; skip?: Record<string, string> }
interface Reference { families: Record<string, RefFamily> }

export interface LockedImage {
  file: string;
  width: number;
  height: number;
  view?: string | null;
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
  const spinLock: Record<string, Record<string, LockedSpin>> = {};
  let ok = 0;
  let frames = 0;
  let failed = 0;
  // Rebuilt from the (cached) downloads every time, so removed images don't linger.
  await fs.rm(OUT, { recursive: true, force: true });
  for (const [familyKey, fam] of Object.entries(ref.families)) {
    const slug = familySlug(familyKey);
    const sheet: { color: string; file: string }[] = [];
    await fs.mkdir(path.join(OUT, slug), { recursive: true });
    for (const [color, images] of Object.entries(fam.images)) {
      if (color.startsWith("?")) continue; // unverified colour assignment — excluded until mapped
      const results = await pool(images, 6, async (img, i) => {
        try {
          const out = await optimise(await download(img.url));
          const rel = `/images/products/${slug}/${slugify(color) || "default"}-${i + 1}.webp`;
          await fs.writeFile(path.join(ROOT, "public", rel), out);
          return { file: rel, width: SIZE, height: SIZE, view: img.view ?? null, sourceUrl: img.url, sourcePage: img.sourcePage ?? fam.sourcePage, credit: img.credit, license: img.license } satisfies LockedImage;
        } catch (err) {
          console.error(`✗ ${familyKey} / ${color} #${i + 1}: ${(err as Error).message}`);
          return null;
        }
      });
      for (const r of results) {
        if (!r) {
          failed++;
          continue;
        }
        ((lock[familyKey] ??= {})[color] ??= []).push(r);
        sheet.push({ color: `${color}${r.view ? ` · ${r.view}` : ""}`, file: r.file });
        ok++;
      }
    }
    for (const [color, spin] of Object.entries(fam.spins ?? {})) {
      const dir = `/images/products/${slug}/360/${slugify(color) || "default"}`;
      await fs.mkdir(path.join(ROOT, "public", dir), { recursive: true });
      const files = await pool(spin.frames, 8, async (url, i) => {
        const rel = `${dir}/${String(i + 1).padStart(3, "0")}.webp`;
        await fs.writeFile(path.join(ROOT, "public", rel), await optimiseSpinFrame(await download(url)));
        return rel;
      }).catch((err) => {
        console.error(`✗ ${familyKey} / ${color} 360: ${(err as Error).message}`);
        return null;
      });
      if (!files) {
        failed++;
        continue;
      }
      (spinLock[familyKey] ??= {})[color] = { frames: files, width: SPIN_SIZE, height: SPIN_SIZE, sourcePage: spin.sourcePage ?? fam.sourcePage, credit: spin.credit, license: spin.license };
      frames += files.length;
      sheet.push({ color: `${color} · 360 (${files.length} frames)`, file: files[0] });
    }
    if (withSheets && sheet.length) await contactSheet(familySlug(familyKey), sheet);
  }
  await fs.writeFile(path.join(ROOT, "catalog/images.lock.json"), JSON.stringify(lock, null, 2) + "\n");
  await fs.writeFile(path.join(ROOT, "catalog/spins.lock.json"), JSON.stringify(spinLock, null, 2) + "\n");
  console.log(`✓ ${ok} images and ${frames} 360° frames written, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main();
