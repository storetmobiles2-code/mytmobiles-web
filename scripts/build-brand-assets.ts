/**
 * Generates web brand assets from the official logo artwork
 * (catalog/brand/myt-logo-official.png — white "my"/"MOBILES", neon-pink "T" on black).
 *
 *   npx tsx scripts/build-brand-assets.ts
 *
 * Outputs (all derived by cropping/resizing the official artwork — no redrawing):
 *   public/brand/myt-logo.png        trimmed wordmark (with glow) for dark backgrounds
 *   src/app/icon.png, apple-icon.png the pink "T" on black (favicon / home-screen icon)
 *   public/brand/og-default.png      1200×630 social share card
 */
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "catalog/brand/myt-logo-official.png");
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

async function main() {
  // Wordmark: crop to the lettering (measured bounding box 166,231 → 914,692) plus
  // a margin that keeps the soft neon glow.
  const M = 36;
  const trimmed = { data: await sharp(SRC).flatten({ background: BLACK }).extract({ left: 166 - M, top: 231 - M, width: 914 - 166 + 2 * M, height: 692 - 231 + 2 * M }).toBuffer() };
  await sharp(trimmed.data)
    .resize({ height: 240 })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(ROOT, "public/brand/myt-logo.png"));

  // Icon: crop the "T" glyph (with glow) from the artwork onto a black square.
  // "T" glyph bounding box 576,232 → 913,536 (measured), with glow margin.
  // Pixels that aren't pink-dominant (the neighbouring white "y") are blacked out.
  const raw = await sharp(SRC).flatten({ background: BLACK }).extract({ left: 556, top: 212, width: 377, height: 344 }).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < raw.data.length; i += raw.info.channels) {
    const [r, g] = [raw.data[i], raw.data[i + 1]];
    if (r - g < 50) raw.data[i] = raw.data[i + 1] = raw.data[i + 2] = 0;
  }
  const t = await sharp(raw.data, { raw: raw.info }).png().toBuffer();
  const square = await sharp({ create: { width: 440, height: 440, channels: 4, background: BLACK } })
    .composite([{ input: t, gravity: "centre" }])
    .png()
    .toBuffer();
  const icon = (size: number) => sharp(square).resize(size, size).png();
  await icon(512).toFile(path.join(ROOT, "src/app/icon.png"));
  await icon(180).toFile(path.join(ROOT, "src/app/apple-icon.png"));
  await icon(512).toFile(path.join(ROOT, "public/brand/icon-512.png"));
  await icon(192).toFile(path.join(ROOT, "public/brand/icon-192.png"));

  // Social card.
  const logo = await sharp(trimmed.data).resize({ height: 380 }).toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: BLACK } })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(path.join(ROOT, "public/brand/og-default.png"));
  console.log("✓ brand assets written");
}

main();
