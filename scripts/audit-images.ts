/**
 * Image quality audit for every official product image in the catalogue: the
 * family pipeline (catalog/reference.json) and product files (catalog/products).
 *
 *   npm run images:audit                 # all products
 *   npm run images:audit -- iphone redmi # only products whose key or slug matches
 *
 * Prints the automatic findings (see scripts/lib/image-quality.ts) and writes one
 * contact sheet per product to .cache/sheets/audit/, each tile labelled with its
 * colour, view and findings. Look at every sheet: the automatic checks can't see
 * clipped close-ups, text-heavy panels or several devices in one shot.
 * Exits 1 when an image has a blocking problem for its view.
 */
import fs from "node:fs";
import path from "node:path";
import { slugify } from "../src/lib/slug";
import { contactSheet, download, pool } from "./lib/image-pipeline";
import { assessImage, blockingIssues, ISSUE_TEXT } from "./lib/image-quality";

const ROOT = process.cwd();
const filters = process.argv.slice(2).map((a) => a.toLowerCase());

interface Item { product: string; color: string | null; view: string | null; url: string; file: string }

function collect(): Item[] {
  const items: Item[] = [];
  const families = JSON.parse(fs.readFileSync(path.join(ROOT, "catalog/images.lock.json"), "utf8")) as Record<string, Record<string, { file: string; view?: string | null; sourceUrl: string }[]>>;
  for (const [family, colours] of Object.entries(families))
    for (const [color, list] of Object.entries(colours)) for (const img of list) items.push({ product: family, color: color || null, view: img.view ?? null, url: img.sourceUrl, file: img.file });
  const files = JSON.parse(fs.readFileSync(path.join(ROOT, "catalog/products/images.lock.json"), "utf8")) as Record<string, { file: string; color: string | null; view?: string | null; sourceUrl: string }[]>;
  for (const [slug, list] of Object.entries(files)) for (const img of list) items.push({ product: slug, color: img.color, view: img.view ?? null, url: img.sourceUrl, file: img.file });
  return items.filter((i) => !filters.length || filters.some((f) => i.product.toLowerCase().includes(f)));
}

async function main() {
  const items = collect();
  const results = await pool(items, 8, async (item) => {
    try {
      return { item, a: await assessImage(await download(item.url)), error: null };
    } catch (e) {
      return { item, a: null, error: (e as Error).message };
    }
  });

  let blocking = 0;
  const byProduct = new Map<string, typeof results>();
  for (const r of results) byProduct.set(r.item.product, [...(byProduct.get(r.item.product) ?? []), r]);
  for (const [product, rs] of byProduct) {
    const lines = rs.flatMap((r, i) => {
      const where = `${r.item.color ?? "—"} #${i + 1}${r.item.view ? ` (${r.item.view})` : ""}`;
      if (r.error) return [`  ? ${where}: couldn't download (${r.error})`];
      const block = blockingIssues(r.a!, r.item.view);
      blocking += block.length ? 1 : 0;
      return r.a!.issues.map((issue) => `  ${block.includes(issue) ? "✗" : "!"} ${where}: ${ISSUE_TEXT[issue]}`);
    });
    console.log(`${lines.some((l) => l.startsWith("  ✗")) ? "✗" : lines.length ? "!" : "✓"} ${product}`);
    for (const l of lines) console.log(l);
    await contactSheet(
      `audit/${slugify(product)}`,
      rs.map((r) => ({ color: [r.item.color ?? "—", r.item.view, ...(r.a?.issues ?? (r.error ? ["no download"] : []))].filter(Boolean).join(" · "), file: r.item.file })),
    );
  }
  console.log(`\n${results.length} images in ${byProduct.size} products; ${blocking} with blocking problems. Contact sheets: .cache/sheets/audit/`);
  if (blocking) process.exitCode = 1;
}

main();
