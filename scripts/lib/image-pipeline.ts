/**
 * Shared image pipeline: cached download, web optimisation and contact sheets.
 * Used by scripts/build-images.ts (stock-sheet families) and scripts/catalog.ts
 * (product spec files).
 *
 * Images are only flattened onto white, trimmed of surrounding whitespace and
 * centred on a square canvas — no retouching, no watermark removal.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const ROOT = process.cwd();
const CACHE = path.join(ROOT, ".cache/images");
export const SIZE = 1200;
const INNER = 1080;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

export async function download(url: string): Promise<Buffer> {
  const key = crypto.createHash("sha1").update(url).digest("hex");
  const file = path.join(CACHE, key);
  try {
    return await fs.readFile(file);
  } catch {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "image/avif,image/webp,image/png,image/*" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.startsWith("image/") && !type.startsWith("application/octet-stream")) throw new Error(`Not an image (${type}): ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.mkdir(CACHE, { recursive: true });
    await fs.writeFile(file, buf);
    return buf;
  }
}

export async function optimise(input: Buffer): Promise<Buffer> {
  const flat = await sharp(input).flatten({ background: "#ffffff" }).toBuffer();
  const trimmed = await sharp(flat).trim({ background: "#ffffff", threshold: 12 }).toBuffer();
  const meta = await sharp(input).metadata();
  if ((meta.width ?? 0) < 400 && (meta.height ?? 0) < 400) console.warn(`  ! source is only ${meta.width}×${meta.height}px — it will look soft`);
  return sharp(trimmed)
    .resize(INNER, INNER, { fit: "inside", withoutEnlargement: false })
    .toBuffer()
    .then((b) =>
      sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: "#ffffff" } })
        .composite([{ input: b, gravity: "centre" }])
        .webp({ quality: 82, effort: 5 })
        .toBuffer(),
    );
}

/** Number of pixels on each side of a 360° frame. */
export const SPIN_SIZE = 960;

/**
 * A 360° frame: flattened and fitted onto a fixed square canvas WITHOUT trimming,
 * so the product stays in the same place from frame to frame.
 */
export async function optimiseSpinFrame(input: Buffer): Promise<Buffer> {
  const flat = await sharp(input).flatten({ background: "#ffffff" }).toBuffer();
  const fitted = await sharp(flat).resize(SPIN_SIZE, SPIN_SIZE, { fit: "contain", background: "#ffffff" }).toBuffer();
  return sharp(fitted).webp({ quality: 74, effort: 4 }).toBuffer();
}

/** Runs async jobs with limited parallelism. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/** Labelled grid of the processed images, for checking model and colour by eye. Returns the file path. */
export async function contactSheet(name: string, entries: { color: string; file: string }[]): Promise<string> {
  const cell = 320;
  const cols = Math.min(4, entries.length);
  const rows = Math.ceil(entries.length / cols);
  const tiles = await Promise.all(
    entries.map(async (e, i) => {
      const img = await sharp(path.join(ROOT, "public", e.file)).resize(cell - 20, cell - 50, { fit: "contain", background: "#ffffff" }).toBuffer();
      const label = Buffer.from(
        `<svg width="${cell}" height="30"><text x="10" y="20" font-size="15" font-family="sans-serif" fill="#111">${(e.color || "—").replace(/&/g, "&amp;").replace(/</g, "&lt;")} #${i + 1}</text></svg>`,
      );
      return [
        { input: img, left: (i % cols) * cell + 10, top: Math.floor(i / cols) * cell + 10 },
        { input: label, left: (i % cols) * cell, top: Math.floor(i / cols) * cell + cell - 36 },
      ];
    }),
  );
  const out = path.join(ROOT, ".cache/sheets", `${name}.png`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: "#e5e7eb" } })
    .composite(tiles.flat())
    .png()
    .toFile(out);
  return out;
}
