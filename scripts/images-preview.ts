/**
 * Preview a proposed set of product images before adding it to the catalogue:
 * downloads every image (and 360° frames), reports pixel sizes, and writes a
 * labelled contact sheet per family for checking model, colour and view by eye.
 *
 *   npx tsx scripts/images-preview.ts <proposal.json>
 *
 * Proposal format (same shape as catalog/reference.json families):
 *   { "families": { "SAMSUNG|GALAXY A07": {
 *       "sourcePage": "https://…",
 *       "images": { "Light Green": [ { "url": "https://…", "view": "front", "credit": "…", "license": "…" } ] },
 *       "spins":  { "Light Green": { "frames": ["https://…/01.jpg", …], "sourcePage": "https://…", "credit": "…", "license": "…" } }
 *   } } }
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { slugify } from "../src/lib/slug";
import { isBannedSource } from "../src/lib/catalog/product-spec";
import { download } from "./lib/image-pipeline";

interface Img { url: string; view?: string }
interface Fam { sourcePage?: string; images?: Record<string, Img[]>; spins?: Record<string, { frames: string[] }> }

const file = process.argv[2];
if (!file) throw new Error("Usage: npx tsx scripts/images-preview.ts <proposal.json>");
const proposal: { families: Record<string, Fam> } = JSON.parse(fs.readFileSync(file, "utf8"));
const OUT = path.join(process.cwd(), ".cache/sheets/preview");
fs.mkdirSync(OUT, { recursive: true });

async function tile(buf: Buffer, label: string, cell = 300) {
  const img = await sharp(buf).flatten({ background: "#ffffff" }).resize(cell - 16, cell - 46, { fit: "contain", background: "#ffffff" }).png().toBuffer();
  const text = Buffer.from(`<svg width="${cell}" height="36"><text x="8" y="22" font-size="13" font-family="sans-serif" fill="#111">${label.replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 44)}</text></svg>`);
  return { img, text };
}

async function sheet(name: string, tiles: { img: Buffer; text: Buffer }[], cell = 300) {
  const cols = Math.min(5, tiles.length);
  const rows = Math.ceil(tiles.length / cols);
  const out = path.join(OUT, `${name}.png`);
  await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: "#e5e7eb" } })
    .composite(tiles.flatMap((t, i) => [
      { input: t.img, left: (i % cols) * cell + 8, top: Math.floor(i / cols) * cell + 8 },
      { input: t.text, left: (i % cols) * cell, top: Math.floor(i / cols) * cell + cell - 38 },
    ]))
    .png()
    .toFile(out);
  return out;
}

async function main() {
  let problems = 0;
  for (const [family, fam] of Object.entries(proposal.families)) {
    const tiles: { img: Buffer; text: Buffer }[] = [];
    for (const [color, list] of Object.entries(fam.images ?? {})) {
      for (const [i, im] of list.entries()) {
        if (isBannedSource(im.url)) {
          console.log(`  ✗ ${family} / ${color} #${i + 1}: retailer/marketplace URL not allowed: ${im.url}`);
          problems++;
          continue;
        }
        try {
          const buf = await download(im.url);
          const meta = await sharp(buf).metadata();
          const small = (meta.width ?? 0) < 500 && (meta.height ?? 0) < 500;
          if (small) problems++;
          console.log(`  ${small ? "!" : "✓"} ${family} / ${color || "—"} / ${im.view ?? "?"}: ${meta.width}×${meta.height}${small ? " (too small)" : ""}`);
          tiles.push(await tile(buf, `${color || "—"} · ${im.view ?? "?"} #${i + 1} ${meta.width}px`));
        } catch (e) {
          problems++;
          console.log(`  ✗ ${family} / ${color} #${i + 1}: ${(e as Error).message}`);
        }
      }
    }
    for (const [color, spin] of Object.entries(fam.spins ?? {})) {
      const step = Math.max(1, Math.floor(spin.frames.length / 10));
      let ok = 0;
      for (const [i, url] of spin.frames.entries()) {
        try {
          const buf = await download(url);
          ok++;
          if (i % step === 0) tiles.push(await tile(buf, `${color || "—"} · 360 frame ${i + 1}/${spin.frames.length}`));
        } catch (e) {
          problems++;
          console.log(`  ✗ ${family} / ${color} 360 frame ${i + 1}: ${(e as Error).message}`);
        }
      }
      console.log(`  ${ok === spin.frames.length ? "✓" : "✗"} ${family} / ${color || "—"} / 360: ${ok}/${spin.frames.length} frames`);
    }
    if (tiles.length) console.log(`  → ${path.relative(process.cwd(), await sheet(slugify(family.replace("|", " ")), tiles))}`);
  }
  console.log(problems ? `\n${problems} problem(s).` : "\n✓ All images downloaded.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
