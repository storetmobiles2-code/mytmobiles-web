import { db } from "@/lib/db";

/** Serves admin-uploaded images stored in Postgres. Content-addressed → cached forever. */
export async function GET(_req: Request, ctx: RouteContext<"/media/[id]">) {
  const { id } = await ctx.params;
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { data: true, mimeType: true, sha256: true } });
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    headers: {
      "content-type": asset.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
      etag: `"${asset.sha256}"`,
      "x-content-type-options": "nosniff",
    },
  });
}
