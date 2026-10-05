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
  if (changed && !apply) console.log("Re-run with --apply to write. Restart the app (or wait for revalidation) to see changes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
