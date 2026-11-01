// Regenerates src/app/favicon.ico (16, 32, 48 px PNG-in-ICO) from src/app/icon.png.
// Usage: node scripts/build-favicon.mjs
import fs from "node:fs";
import sharp from "sharp";

const SIZES = [16, 32, 48];
const pngs = await Promise.all(SIZES.map((s) => sharp("src/app/icon.png").resize(s, s).png({ compressionLevel: 9 }).toBuffer()));

const head = Buffer.alloc(6);
head.writeUInt16LE(1, 2); // type: icon
head.writeUInt16LE(SIZES.length, 4);
let offset = 6 + 16 * SIZES.length;
const dir = pngs.map((png, i) => {
  const e = Buffer.alloc(16);
  e[0] = SIZES[i];
  e[1] = SIZES[i];
  e.writeUInt16LE(1, 4); // planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(png.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += png.length;
  return e;
});
fs.writeFileSync("src/app/favicon.ico", Buffer.concat([head, ...dir, ...pngs]));
