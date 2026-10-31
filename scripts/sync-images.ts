/**
 * Applies catalog/images.lock.json to an existing database.
 *
 *   npm run images:sync            # dry run: prints what would change
 *   npm run images:sync -- --apply # writes the changes
 *
 * The seed only imports the catalogue into an empty database, so images added to
 * catalog/reference.json later (and built with `npm run images:build`) need this
 * step. Products are matched through their variants' stock-sheet names, so
 * products renamed in the admin panel still match.
 *
 * Only catalogue-managed images (/images/products/...) are replaced. Images
 * uploaded in the admin panel (/media/...) are kept and placed after them.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseStockCsv } from "../src/lib/catalog/csv";
import { buildCatalog } from "../src/lib/catalog/build-catalog";
import { normaliseSheetName } from "../src/lib/catalog/stock-parse";
import { repointStaleImage } from "./lib/image-paths";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const ROOT = process.cwd();
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const MANAGED = "/images/products/";

async function main() {
  const apply = process.argv.includes("--apply");
  const { rows } = parseStockCsv(fs.readFileSync(path.join(ROOT, "catalog/stock-sheet.csv"), "utf8"));
  const { products } = buildCatalog({
    rows,
    reference: readJson("catalog/reference.json").families,
    images: readJson("catalog/images.lock.json"),
    spins: fs.existsSync(path.join(ROOT, "catalog/spins.lock.json")) ? readJson("catalog/spins.lock.json") : {},
    overrides: readJson("catalog/overrides.json").families,
  });

  const variants = await db.productVariant.findMany({ select: { productId: true, externalNames: true } });
  const productByName = new Map<string, string>();
  for (const v of variants) for (const n of v.externalNames) productByName.set(normaliseSheetName(n), v.productId);

  let changed = 0;
  let unmatched = 0;
  for (const p of products) {
    const productId = p.variants.flatMap((v) => v.externalNames).map((n) => productByName.get(normaliseSheetName(n))).find(Boolean);
    if (!productId) {
      unmatched++;
      continue;
    }
    const current = await db.productImage.findMany({ where: { productId }, orderBy: { sortOrder: "asc" } });
    const managed = current.filter((i) => i.url.startsWith(MANAGED));
    const uploaded = current.filter((i) => !i.url.startsWith(MANAGED));
    const spins = await db.productSpin.findMany({ where: { productId } });
    const managedSpins = spins.filter((s) => s.frames[0]?.startsWith(MANAGED));
    const sameImages =
      managed.length === p.images.length &&
      managed.every((m, i) => m.url === p.images[i].file && m.color === p.images[i].color && m.sourceUrl === p.images[i].sourceUrl && (m.view ?? null) === (p.images[i].view ?? null));
    const sameSpins = managedSpins.length === p.spins.length && managedSpins.every((m, i) => JSON.stringify(m.frames) === JSON.stringify(p.spins[i].frames) && m.color === p.spins[i].color);
    if (sameImages && sameSpins) continue;

    changed++;
    console.log(
      `${apply ? "~" : "would update"} ${p.name}: ${managed.length} → ${p.images.length} catalogue image(s), ${managedSpins.length} → ${p.spins.length} 360° spin(s)${uploaded.length ? `, keeping ${uploaded.length} uploaded` : ""}`,
    );
    if (!apply) continue;
    await db.$transaction([
      db.productImage.deleteMany({ where: { id: { in: managed.map((m) => m.id) } } }),
      ...p.images.map((img, i) =>
        db.productImage.create({
          data: {
            productId, url: img.file, alt: img.alt, color: img.color, width: img.width, height: img.height, sortOrder: i, view: img.view ?? null,
            sourceUrl: img.sourceUrl, credit: img.credit, license: img.license,
          },
        }),
      ),
      ...uploaded.map((u, i) => db.productImage.update({ where: { id: u.id }, data: { sortOrder: p.images.length + i } })),
      db.productSpin.deleteMany({ where: { id: { in: managedSpins.map((s) => s.id) } } }),
      ...p.spins.map((s) =>
        db.productSpin.create({ data: { productId, color: s.color, frames: s.frames, width: s.width, height: s.height, sourceUrl: s.sourcePage, credit: s.credit, license: s.license } }),
      ),
    ]);
  }
  console.log(`${changed} product(s) ${apply ? "updated" : "to update"}; ${unmatched} catalogue product(s) not in the database.`);
  const repointed = await repointCopies(apply);
  if ((changed || repointed) && !apply) console.log("Re-run with --apply to write. Restart the app (or wait for revalidation) to see changes.");
}

/**
 * Banners, categories and order items keep a copy of a product image's path. A rebuild that
 * renames or reorders images leaves those copies pointing at a missing file, so each one is
 * repointed at the current first image of the same colour (see scripts/lib/image-paths.ts).
 */
async function repointCopies(apply: boolean): Promise<number> {
  const listFolder = (url: string) => {
    const dir = path.join(ROOT, "public", url.slice(0, url.lastIndexOf("/")));
    return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  };
  const isStale = (url: string | null): url is string =>
    !!url && (url.startsWith(MANAGED) || url.startsWith("/images/catalog/")) && !fs.existsSync(path.join(ROOT, "public", url));

  const copies = [
    ...(await db.banner.findMany({ select: { id: true, imageUrl: true } })).map((r) => ({ table: "banner" as const, ...r })),
    ...(await db.category.findMany({ select: { id: true, imageUrl: true } })).map((r) => ({ table: "category" as const, ...r })),
    ...(await db.orderItem.findMany({ where: { imageUrl: { startsWith: "/images/" } }, select: { id: true, imageUrl: true } })).map((r) => ({ table: "orderItem" as const, ...r })),
  ].filter((c) => isStale(c.imageUrl));

  let repointed = 0;
  for (const c of copies) {
    const to = repointStaleImage(c.imageUrl!, listFolder(c.imageUrl!));
    if (!to) {
      console.log(`! ${c.table} ${c.id}: ${c.imageUrl} no longer exists and that colour has no image now; set it in Admin`);
      continue;
    }
    repointed++;
    console.log(`${apply ? "~" : "would repoint"} ${c.table} ${c.id}: ${c.imageUrl} → ${to}`);
    if (!apply) continue;
    if (c.table === "banner") await db.banner.update({ where: { id: c.id }, data: { imageUrl: to } });
    else if (c.table === "category") await db.category.update({ where: { id: c.id }, data: { imageUrl: to } });
    else await db.orderItem.update({ where: { id: c.id }, data: { imageUrl: to } });
  }
  if (copies.length) console.log(`${repointed} stored image path(s) ${apply ? "repointed" : "to repoint"}.`);
  return repointed;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
