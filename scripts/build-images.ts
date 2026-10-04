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
import crypto from "node:crypto";
import sharp from "sharp";
import { slugify } from "../src/lib/slug";

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
const CACHE = path.join(ROOT, ".cache/images");
const OUT = path.join(ROOT, "public/images/products");
const SIZE = 1200;
const INNER = 1080;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

export function familySlug(familyKey: string): string {
  const [brand, model] = familyKey.split("|");
  return slugify(`${brand} ${model}`);
}

async function download(url: string): Promise<Buffer> {
  const key = crypto.createHash("sha1").update(url).digest("hex");
  const file = path.join(CACHE, key);
  try {
    return await fs.readFile(file);
  } catch {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "image/avif,image/webp,image/png,image/*" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.mkdir(CACHE, { recursive: true });
    await fs.writeFile(file, buf);
    return buf;
  }
}

async function optimise(input: Buffer): Promise<Buffer> {
  const flat = await sharp(input).flatten({ background: "#ffffff" }).toBuffer();
  const trimmed = await sharp(flat).trim({ background: "#ffffff", threshold: 12 }).toBuffer();
  return sharp(trimmed)
    .resize(INNER, INNER, { fit: "inside", withoutEnlargement: false })
    .extend({ top: 0, bottom: 0, left: 0, right: 0, background: "#ffffff" })
    .toBuffer()
    .then((b) =>
      sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: "#ffffff" } })
        .composite([{ input: b, gravity: "centre" }])
        .webp({ quality: 82, effort: 5 })
        .toBuffer(),
    );
}

async function contactSheet(familyKey: string, entries: { color: string; file: string }[]) {
  const cell = 320;
  const cols = Math.min(4, entries.length);
  const rows = Math.ceil(entries.length / cols);
  const tiles = await Promise.all(
    entries.map(async (e, i) => {
      const img = await sharp(path.join(ROOT, "public", e.file)).resize(cell - 20, cell - 50).toBuffer();
      const label = Buffer.from(
        `<svg width="${cell}" height="30"><text x="10" y="20" font-size="15" font-family="sans-serif" fill="#111">${(e.color || "—").replace(/&/g, "&amp;")} #${i + 1}</text></svg>`,
      );
      return [
        { input: img, left: (i % cols) * cell + 10, top: Math.floor(i / cols) * cell + 10 },
        { input: label, left: (i % cols) * cell, top: Math.floor(i / cols) * cell + cell - 36 },
      ];
    }),
  );
  await fs.mkdir(path.join(ROOT, ".cache/sheets"), { recursive: true });
  await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: "#e5e7eb" } })
    .composite(tiles.flat())
    .png()
    .toFile(path.join(ROOT, ".cache/sheets", `${familySlug(familyKey)}.png`));
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
    if (withSheets && sheet.length) await contactSheet(familyKey, sheet);
  }
  await fs.writeFile(path.join(ROOT, "catalog/images.lock.json"), JSON.stringify(lock, null, 2) + "\n");
  console.log(`✓ ${ok} images written, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main();
