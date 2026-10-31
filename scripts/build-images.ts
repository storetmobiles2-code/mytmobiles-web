/**
 * Downloads the official product images listed in catalog/reference.json,
 * optimises them for the web and records provenance.
 *
 *   npm run images:build            # process everything (cached downloads are reused)
 *   npm run images:build -- --sheets  # also write labelled contact sheets for visual QA
 *
 * Output
 *   public/images/products/<family-slug>/<colour-slug>-<n>-<hash>.webp   1200×1200, white background
 *   catalog/images.lock.json   file → { source URL, page, credit, licence, dimensions }
 *
 * The trailing hash is a content fingerprint (contentFingerprint() in lib/image-pipeline.ts), not
 * a counter: it changes whenever that slot's picture changes, even though the slot's position (and
 * so the rest of the filename) is reused across a rebuild. Without it, a stale browser or Next.js
 * image-optimizer cache can go on serving the old picture at that URL indefinitely.
 *
 * Images are trimmed of surrounding whitespace and centred on a square canvas
 * with padding — no other edits are made (no retouching, no watermark removal).
 *
 * Quality gate: images listed in catalog/images.rejected.json, and images whose
 * source fails a blocking check for their view (scripts/lib/image-quality.ts),
 * are left out. When a source can't be downloaded, the previous build of that
 * image is kept rather than dropped.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { slugify } from "../src/lib/slug";
import { contactSheet, contentFingerprint, download, optimise, optimiseSpinFrame, pool, SIZE, SPIN_SIZE } from "./lib/image-pipeline";
import { assessImage, blockingIssues, ISSUE_TEXT, readRejected } from "./lib/image-quality";

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
  let rejected = 0;
  const rejectedUrls = readRejected(ROOT);
  // The previous build, kept in memory so an image whose source is unreachable today isn't lost.
  const previousLock: Record<string, Record<string, LockedImage[]>> = JSON.parse(await fs.readFile(path.join(ROOT, "catalog/images.lock.json"), "utf8").catch(() => "{}"));
  const previous = new Map<string, Buffer>();
  for (const colours of Object.values(previousLock))
    for (const list of Object.values(colours))
      for (const img of list) {
        const buf = await fs.readFile(path.join(ROOT, "public", img.file)).catch(() => null);
        if (buf) previous.set(img.sourceUrl, buf);
      }
  // Rebuilt from the (cached) downloads every time, so removed images don't linger.
  await fs.rm(OUT, { recursive: true, force: true });
  for (const [familyKey, fam] of Object.entries(ref.families)) {
    const slug = familySlug(familyKey);
    const sheet: { color: string; file: string }[] = [];
    await fs.mkdir(path.join(OUT, slug), { recursive: true });
    for (const [color, images] of Object.entries(fam.images)) {
      if (color.startsWith("?")) continue; // unverified colour assignment — excluded until mapped
      const accepted = images.filter((img) => !rejectedUrls.has(img.url));
      rejected += images.length - accepted.length;
      const results = await pool(accepted, 6, async (img, i) => {
        let out: Buffer;
        try {
          const source = await download(img.url);
          const block = blockingIssues(await assessImage(source), img.view);
          if (block.length) {
            console.error(`✗ ${familyKey} / ${color} #${i + 1} (${img.view ?? "no view"}) rejected: ${block.map((b) => ISSUE_TEXT[b]).join("; ")}`);
            return "rejected" as const;
          }
          out = await optimise(source);
        } catch (err) {
          const kept = previous.get(img.url);
          if (!kept) {
            console.error(`✗ ${familyKey} / ${color} #${i + 1}: ${(err as Error).message}`);
            return null;
          }
          console.warn(`! ${familyKey} / ${color} #${i + 1}: source unreachable (${(err as Error).message}); kept the previous build`);
          out = kept;
        }
        // The fingerprint busts the browser's and Next's image-optimizer caches whenever this
        // slot's content changes, even though a rejection or a reorder can reuse its old position
        // (and so its old filename) for different content.
        const rel = `/images/products/${slug}/${slugify(color) || "default"}-${i + 1}-${contentFingerprint(out)}.webp`;
        await fs.writeFile(path.join(ROOT, "public", rel), out);
        return { file: rel, width: SIZE, height: SIZE, view: img.view ?? null, sourceUrl: img.url, sourcePage: img.sourcePage ?? fam.sourcePage, credit: img.credit, license: img.license } satisfies LockedImage;
      });
      for (const r of results) {
        if (r === "rejected") {
          rejected++;
          continue;
        }
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
        const out = await optimiseSpinFrame(await download(url));
        const rel = `${dir}/${String(i + 1).padStart(3, "0")}-${contentFingerprint(out)}.webp`;
        await fs.writeFile(path.join(ROOT, "public", rel), out);
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
  console.log(`✓ ${ok} images and ${frames} 360° frames written, ${rejected} rejected, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main();
