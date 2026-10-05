import "server-only";
import { createHash } from "node:crypto";
import sharp, { type OutputInfo } from "sharp";
import { db } from "@/lib/db";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export class UploadError extends Error {}

/**
 * Validates and normalises an uploaded image (auto-orient, strip metadata,
 * max 1600px, WebP) and stores it content-addressed in Postgres.
 */
export async function storeImageUpload(file: File, maxSide = 1600): Promise<{ url: string; width: number; height: number }> {
  if (!ALLOWED.has(file.type)) throw new UploadError("Upload a JPEG, PNG, WebP or AVIF image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Images must be 8 MB or smaller.");
  const input = Buffer.from(await file.arrayBuffer());
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new UploadError("That file isn't a valid image.");
  }
  const sha256 = createHash("sha256").update(out.data).digest("hex");
  const asset = await db.mediaAsset.upsert({
    where: { sha256 },
    update: {},
    create: { sha256, filename: file.name.slice(0, 200), mimeType: "image/webp", width: out.info.width, height: out.info.height, size: out.data.length, data: new Uint8Array(out.data) },
  });
  return { url: `/media/${asset.id}`, width: asset.width, height: asset.height };
}
