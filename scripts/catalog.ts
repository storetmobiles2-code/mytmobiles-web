/**
 * Catalogue tooling for staff and maintenance agents. Every command is safe to
 * run: anything that writes to the database needs --write.
 *
 *   npm run catalog -- new <slug> --brand "Samsung" --name "Galaxy A57 5G" --category smartphones
 *   npm run catalog -- export <slug> [--with-images] [--force]   DB product → catalog/products/<slug>.json
 *   npm run catalog -- validate [slug…]                          schema + store rules (all specs if none given)
 *   npm run catalog -- images <slug>                             download, optimise, contact sheet for review
 *   npm run catalog -- apply <slug…|--all> [--write] [--revalidate]   show / write the changes
 *   npm run catalog -- deployed <slug…|--all> --site <url>        wait until spec images are live on the site
 *   npm run catalog -- report [--json]                           catalogue health (missing images, MRP, legal…)
 *   npm run catalog -- stock-plan <sheet.csv> [--json]           preview a POS stock-sheet import, with warnings
 *
 * Product files are described in src/lib/catalog/product-spec.ts.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { checkSpec, type ProductSpec, type SpecProblem } from "@/lib/catalog/product-spec";
import { refreshProductAggregates } from "@/lib/catalog/queries";
import { planStockImport } from "@/lib/catalog/stock-import";
import { parseStockCsv } from "@/lib/catalog/csv";
import { slugify } from "@/lib/slug";
import { contactSheet, download, optimise, SIZE } from "./lib/image-pipeline";

const ROOT = process.cwd();
const SPEC_DIR = path.join(ROOT, "catalog/products");
const LOCK_FILE = path.join(SPEC_DIR, "images.lock.json");
const IMAGE_DIR = "/images/catalog";

interface LockedSpecImage {
  file: string;
  width: number;
  height: number;
  color: string | null;
  sourceUrl: string;
  sourcePage: string;
  credit: string;
  license: string;
}

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = () => {
  const out: string[] = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      if (["brand", "name", "category", "site"].includes(args[i].slice(2))) i++;
      continue;
    }
    out.push(args[i]);
  }
  return out;
};

const rs = (paise: number) => paise / 100;
const ps = (rupees: number) => Math.round(rupees * 100);
const specFile = (slug: string) => path.join(SPEC_DIR, `${slug}.json`);
const readLock = (): Record<string, LockedSpecImage[]> => (fs.existsSync(LOCK_FILE) ? JSON.parse(fs.readFileSync(LOCK_FILE, "utf8")) : {});
const writeJson = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
};
const allSlugs = () =>
  fs.existsSync(SPEC_DIR) ? fs.readdirSync(SPEC_DIR).filter((f) => f.endsWith(".json") && f !== "images.lock.json" && !f.startsWith("_")).map((f) => f.slice(0, -5)).sort() : [];

function loadSpec(slug: string): { spec: ProductSpec | null; problems: SpecProblem[] } {
  const file = specFile(slug);
  if (!fs.existsSync(file)) return { spec: null, problems: [{ level: "error", path: "", message: `No file catalog/products/${slug}.json` }] };
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return { spec: null, problems: [{ level: "error", path: "", message: `Invalid JSON: ${(e as Error).message}` }] };
  }
  return checkSpec(raw, slug);
}

function printProblems(slug: string, problems: SpecProblem[]) {
  for (const p of problems) console.log(`  ${p.level === "error" ? "✗" : "!"} ${slug}${p.path ? ` › ${p.path}` : ""}: ${p.message}`);
}

/* ───────────────────────── new ───────────────────────── */

function cmdNew() {
  const [slug] = positional();
  const brand = option("brand");
  const name = option("name");
  const category = option("category") ?? "smartphones";
  if (!slug || !brand || !name) throw new Error('Usage: catalog new <slug> --brand "Samsung" --name "Samsung Galaxy A57 5G" [--category smartphones]');
  if (fs.existsSync(specFile(slug))) throw new Error(`catalog/products/${slug}.json already exists`);
  const today = new Date().toISOString().slice(0, 10);
  writeJson(specFile(slug), {
    slug,
    name,
    brand,
    category,
    condition: "NEW",
    status: "draft",
    is5G: false,
    launchedAt: null,
    shortDescription: "TODO one-line summary",
    description: "TODO two or three short paragraphs in plain language",
    highlights: [],
    specs: [{ group: "Display", items: [{ label: "Size", value: "TODO" }] }],
    boxContents: [],
    keywords: [],
    warranty: "1 year manufacturer warranty",
    manufacturerInfo: null,
    countryOfOrigin: null,
    hsnCode: "85171300",
    gstRatePercent: 18,
    returnWindowDays: 7,
    variants: [{ sku: `${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-1`, color: null, colorHex: null, ramGb: null, storageGb: null, mrp: 1, stockSheetNames: [] }],
    images: [],
    sources: [{ url: "https://TODO-official-product-page", usedFor: ["details", "specs", "mrp", "images", "legal"], retrievedAt: today }],
  });
  console.log(`✓ Created catalog/products/${slug}.json — fill in the TODOs, then: npm run catalog -- validate ${slug}`);
}

/* ───────────────────────── export ───────────────────────── */

async function cmdExport() {
  const [slug] = positional();
  if (!slug) throw new Error("Usage: catalog export <slug> [--with-images] [--force]");
  if (fs.existsSync(specFile(slug)) && !flag("force")) throw new Error(`catalog/products/${slug}.json exists (use --force to overwrite)`);
  const p = await db.product.findUnique({
    where: { slug },
    include: { brand: true, category: true, variants: { orderBy: [{ sortOrder: "asc" }, { price: "asc" }] }, images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!p) throw new Error(`No product with slug ${slug}`);
  const spec = {
    slug: p.slug,
    name: p.name,
    brand: p.brand.name,
    category: p.category.slug,
    condition: p.condition,
    status: p.isActive ? "live" : "draft",
    featured: p.isFeatured,
    is5G: p.is5G,
    launchedAt: p.launchedAt ? p.launchedAt.toISOString().slice(0, 10) : null,
    shortDescription: p.shortDescription,
    description: p.description,
    highlights: p.highlights,
    specs: p.specs,
    boxContents: p.boxContents,
    keywords: p.keywords,
    warranty: p.warranty,
    manufacturerInfo: p.manufacturerInfo,
    countryOfOrigin: p.countryOfOrigin,
    hsnCode: p.hsnCode,
    gstRatePercent: p.gstRateBps / 100,
    returnWindowDays: p.returnWindowDays,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    variants: p.variants
      .filter((v) => v.isActive)
      .map((v) => ({
        sku: v.sku,
        color: v.color,
        colorHex: v.colorHex,
        ramGb: v.ramGb,
        storageGb: v.storageGb,
        mrp: rs(v.mrp),
        // Price stays owned by the stock sheet unless the variant isn't on it.
        ...(v.externalNames.length ? {} : { price: rs(v.price) }),
        maxPerOrder: v.maxPerOrder,
        stockSheetNames: v.externalNames,
      })),
    ...(flag("with-images")
      ? {
          images: p.images
            .filter((i) => i.sourceUrl)
            .map((i) => ({ color: i.color, url: i.sourceUrl, sourcePage: i.sourceUrl, credit: i.credit ?? "", license: i.license ?? "" })),
        }
      : {}),
    sources: [],
  };
  writeJson(specFile(slug), spec);
  const { problems } = checkSpec(spec, slug);
  console.log(`✓ Wrote catalog/products/${slug}.json`);
  printProblems(slug, problems);
}

/* ───────────────────────── validate ───────────────────────── */

async function cmdValidate() {
  const slugs = positional().length ? positional() : allSlugs();
  if (!slugs.length) {
    console.log("No product files in catalog/products/.");
    return;
  }
  const categories = new Set((await db.category.findMany({ select: { slug: true } })).map((c) => c.slug));
  let errors = 0;
  for (const slug of slugs) {
    const { spec, problems } = loadSpec(slug);
    if (spec && !categories.has(spec.category)) problems.push({ level: "error", path: "category", message: `Unknown category "${spec.category}" (${[...categories].join(", ")})` });
    if (spec?.images?.length) {
      const locked = readLock()[slug] ?? [];
      if (locked.map((l) => l.sourceUrl).join() !== spec.images.map((i) => i.url).join())
        problems.push({ level: spec.status === "live" ? "error" : "warning", path: "images", message: `Images not built yet — run: npm run catalog -- images ${slug}` });
    }
    const e = problems.filter((p) => p.level === "error").length;
    errors += e;
    console.log(`${e ? "✗" : "✓"} ${slug}${problems.length ? "" : " — OK"}`);
    printProblems(slug, problems);
  }
  if (errors) {
    console.log(`\n${errors} error(s).`);
    process.exitCode = 1;
  }
}

/* ───────────────────────── images ───────────────────────── */

async function cmdImages() {
  const [slug] = positional();
  if (!slug) throw new Error("Usage: catalog images <slug>");
  const { spec, problems } = loadSpec(slug);
  if (!spec) {
    printProblems(slug, problems);
    throw new Error("Fix the spec first");
  }
  const banned = problems.filter((p) => p.path.startsWith("images") && p.level === "error");
  if (banned.length) {
    printProblems(slug, banned);
    throw new Error("Fix the image list first");
  }
  const dir = path.join(ROOT, "public", IMAGE_DIR, slug);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const entries: LockedSpecImage[] = [];
  const counts: Record<string, number> = {};
  for (const img of spec.images ?? []) {
    const key = slugify(img.color ?? "") || "default";
    counts[key] = (counts[key] ?? 0) + 1;
    const rel = `${IMAGE_DIR}/${slug}/${key}-${counts[key]}.webp`;
    const out = await optimise(await download(img.url));
    fs.writeFileSync(path.join(ROOT, "public", rel), out);
    entries.push({ file: rel, width: SIZE, height: SIZE, color: img.color, sourceUrl: img.url, sourcePage: img.sourcePage, credit: img.credit, license: img.license });
    console.log(`  ✓ ${rel}  ←  ${img.url}`);
  }
  const lock = readLock();
  if (entries.length) lock[slug] = entries;
  else delete lock[slug];
  writeJson(LOCK_FILE, Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b))));
  if (entries.length) {
    const sheet = await contactSheet(`catalog-${slug}`, entries.map((e) => ({ color: e.color ?? "", file: e.file })));
    console.log(`✓ ${entries.length} image(s). Check them against the exact model and colour: ${path.relative(ROOT, sheet)}`);
  } else console.log("No images in the spec.");
}

/* ───────────────────────── apply ───────────────────────── */

type Change = string;

async function applyOne(spec: ProductSpec, write: boolean): Promise<{ changes: Change[]; productId: string | null }> {
  const changes: Change[] = [];
  const allNames = spec.variants.flatMap((v) => v.stockSheetNames);
  let product = await db.product.findUnique({ where: { slug: spec.slug }, include: { variants: true, images: true } });
  if (!product && allNames.length) {
    // A product created by a stock import under another slug: adopt it.
    const viaStock = await db.product.findFirst({ where: { variants: { some: { externalNames: { hasSome: allNames } } } }, include: { variants: true, images: true } });
    if (viaStock) {
      if (viaStock.isActive) throw new Error(`Live product "${viaStock.slug}" already has these stock-sheet names. Use slug "${viaStock.slug}" (renaming a live URL breaks links).`);
      changes.push(`slug: ${viaStock.slug} → ${spec.slug} (hidden product created by stock import)`);
      product = viaStock;
    }
  }
  const category = await db.category.findUnique({ where: { slug: spec.category } });
  if (!category) throw new Error(`Unknown category "${spec.category}"`);
  const brand = await db.brand.findUnique({ where: { name: spec.brand } });
  if (!brand) changes.push(`brand: create "${spec.brand}"`);

  const lock = readLock()[spec.slug] ?? [];
  if (spec.images && lock.map((l) => l.sourceUrl).join() !== spec.images.map((i) => i.url).join()) throw new Error(`Images not built — run: npm run catalog -- images ${spec.slug}`);

  const fields = {
    slug: spec.slug,
    name: spec.name,
    categoryId: category.id,
    condition: spec.condition,
    isFeatured: spec.featured,
    is5G: spec.is5G,
    launchedAt: spec.launchedAt ? new Date(spec.launchedAt) : null,
    shortDescription: spec.shortDescription,
    description: spec.description,
    highlights: spec.highlights,
    specs: spec.specs,
    boxContents: spec.boxContents,
    keywords: spec.keywords,
    warranty: spec.warranty,
    manufacturerInfo: spec.manufacturerInfo,
    countryOfOrigin: spec.countryOfOrigin,
    hsnCode: spec.hsnCode,
    gstRateBps: spec.gstRatePercent * 100,
    returnWindowDays: spec.returnWindowDays,
    seoTitle: spec.seoTitle,
    seoDescription: spec.seoDescription,
  };
  if (!product) changes.push(`product: create "${spec.name}" (hidden until status is live)`);
  else {
    for (const [k, v] of Object.entries(fields)) {
      if (k === "slug" && product.slug !== spec.slug) continue; // reported above
      const before = (product as Record<string, unknown>)[k];
      const same = JSON.stringify(before instanceof Date ? before.toISOString().slice(0, 10) : before) === JSON.stringify(v instanceof Date ? v.toISOString().slice(0, 10) : v);
      if (!same) changes.push(`${k}: ${short(before)} → ${short(v)}`);
    }
    if (brand && brand.id !== product.brandId) changes.push(`brand → ${spec.brand}`);
  }

  // Variants: match by SKU, then by stock-sheet name.
  const existing = product?.variants ?? [];
  const plans = spec.variants.map((v) => {
    const match = existing.find((e) => e.sku === v.sku) ?? existing.find((e) => e.externalNames.some((n) => v.stockSheetNames.includes(n)));
    return { v, match };
  });
  for (const { v, match } of plans) {
    const label = [v.color, v.ramGb && `${v.ramGb}GB`, v.storageGb && `${v.storageGb}GB`].filter(Boolean).join(" ") || v.sku;
    if (!match) changes.push(`variant ${label}: create (MRP ₹${v.mrp}${v.price ? `, price ₹${v.price}` : ", price from stock sheet"}, stock 0 until the next stock import)`);
    else {
      if (match.mrp !== ps(v.mrp)) changes.push(`variant ${label}: MRP ₹${rs(match.mrp)} → ₹${v.mrp}`);
      if (v.price !== undefined && match.price !== ps(v.price)) changes.push(`variant ${label}: price ₹${rs(match.price)} → ₹${v.price}`);
      const effectivePrice = v.price !== undefined ? ps(v.price) : match.price;
      if (effectivePrice > ps(v.mrp)) throw new Error(`variant ${label}: stock-sheet price ₹${rs(effectivePrice)} is above the new MRP ₹${v.mrp}`);
      if ((match.color ?? null) !== v.color || (match.ramGb ?? null) !== v.ramGb || (match.storageGb ?? null) !== v.storageGb) changes.push(`variant ${label}: colour/RAM/storage updated`);
      const newNames = v.stockSheetNames.filter((n) => !match.externalNames.includes(n));
      if (newNames.length) changes.push(`variant ${label}: link stock-sheet names ${newNames.map((n) => `"${n}"`).join(", ")}`);
    }
  }
  const unlisted = existing.filter((e) => e.isActive && !plans.some((p) => p.match?.id === e.id));
  if (unlisted.length) changes.push(`note: ${unlisted.length} existing variant(s) not in the spec are left unchanged (${unlisted.map((u) => u.sku).join(", ")})`);

  if (spec.images) {
    const managed = (product?.images ?? []).filter((i) => i.url.startsWith("/images/"));
    const same = managed.length === lock.length && managed.every((m, i) => m.url === lock[i].file);
    if (!same) changes.push(`images: ${managed.length} → ${lock.length} (uploaded /media images are kept)`);
  }

  const wantActive = spec.status === "live" ? true : spec.status === "hidden" ? false : null;
  if (wantActive !== null && wantActive !== (product?.isActive ?? false)) changes.push(wantActive ? "publish: product goes live" : "unpublish: product is hidden");

  if (!write) return { changes, productId: product?.id ?? null };

  const productId = await db.$transaction(async (tx) => {
    const b = brand ?? (await tx.brand.create({ data: { name: spec.brand, slug: slugify(spec.brand) } }));
    const p = product
      ? await tx.product.update({ where: { id: product.id }, data: { ...fields, brandId: b.id } })
      : await tx.product.create({ data: { ...fields, brandId: b.id, isActive: false } });
    for (const [i, { v, match }] of plans.entries()) {
      const data = {
        sku: v.sku,
        color: v.color,
        colorHex: v.colorHex,
        ramGb: v.ramGb,
        storageGb: v.storageGb,
        ram: v.ramGb ? `${v.ramGb} GB` : null,
        storage: v.storageGb ? (v.storageGb >= 1024 && v.storageGb % 1024 === 0 ? `${v.storageGb / 1024} TB` : `${v.storageGb} GB`) : null,
        mrp: ps(v.mrp),
        maxPerOrder: v.maxPerOrder,
        sortOrder: i,
        isActive: true,
      };
      if (match) {
        await tx.productVariant.update({
          where: { id: match.id },
          data: { ...data, ...(v.price !== undefined ? { price: ps(v.price) } : {}), externalNames: [...new Set([...match.externalNames, ...v.stockSheetNames])] },
        });
      } else {
        await tx.productVariant.create({ data: { ...data, productId: p.id, price: ps(v.price ?? v.mrp), stock: 0, externalNames: v.stockSheetNames } });
      }
    }
    if (spec.images) {
      const current = await tx.productImage.findMany({ where: { productId: p.id }, orderBy: { sortOrder: "asc" } });
      await tx.productImage.deleteMany({ where: { id: { in: current.filter((c) => c.url.startsWith("/images/")).map((c) => c.id) } } });
      const counts: Record<string, number> = {};
      for (const [i, img] of lock.entries()) {
        const n = (counts[img.color ?? ""] = (counts[img.color ?? ""] ?? 0) + 1);
        await tx.productImage.create({
          data: {
            productId: p.id, url: img.file, width: img.width, height: img.height, color: img.color, sortOrder: i,
            alt: `${spec.name}${img.color ? ` in ${img.color}` : ""}${n > 1 ? ` — view ${n}` : ""}`,
            sourceUrl: img.sourceUrl, credit: img.credit, license: img.license,
          },
        });
      }
      const uploads = current.filter((c) => !c.url.startsWith("/images/"));
      for (const [i, u] of uploads.entries()) await tx.productImage.update({ where: { id: u.id }, data: { sortOrder: lock.length + i } });
    }
    await refreshProductAggregates([p.id], tx);
    if (wantActive !== null) {
      if (wantActive) {
        const check = await tx.product.findUniqueOrThrow({ where: { id: p.id }, select: { _count: { select: { images: true, variants: true } } } });
        if (!check._count.images) throw new Error("Can't publish without images");
      }
      await tx.product.update({ where: { id: p.id }, data: { isActive: wantActive } });
    }
    return p.id;
  });
  return { changes, productId };
}

const short = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s === undefined ? "∅" : s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

async function cmdApply() {
  const write = flag("write");
  const slugs = flag("all") ? allSlugs() : positional();
  if (!slugs.length) throw new Error("Usage: catalog apply <slug…|--all> [--write] [--revalidate]");
  let failed = 0;
  let changed = 0;
  for (const slug of slugs) {
    const { spec, problems } = loadSpec(slug);
    const errors = problems.filter((p) => p.level === "error");
    if (!spec || errors.length) {
      failed++;
      console.log(`✗ ${slug}: invalid spec`);
      printProblems(slug, errors);
      continue;
    }
    try {
      const { changes } = await applyOne(spec, write);
      const real = changes.filter((c) => !c.startsWith("note:"));
      if (real.length) changed++;
      console.log(`${real.length ? (write ? "✓ applied" : "~ would change") : "= no changes"} ${slug}`);
      for (const c of changes) console.log(`    ${c}`);
    } catch (e) {
      failed++;
      console.log(`✗ ${slug}: ${(e as Error).message}`);
    }
  }
  if (!write && changed) console.log("\nDry run. Re-run with --write to apply.");
  if (write && changed && flag("revalidate")) await revalidate();
  if (failed) process.exitCode = 1;
}

/** Ask the running site to drop cached catalogue pages (needs CRON_SECRET and the site URL). */
async function revalidate() {
  const site = option("site") ?? process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) {
    console.log("! Skipped cache refresh: set NEXT_PUBLIC_SITE_URL (or --site) and CRON_SECRET. Pages refresh on their own within 10 minutes.");
    return;
  }
  const res = await fetch(`${site.replace(/\/$/, "")}/api/revalidate`, { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify({ tags: ["catalog"] }) });
  console.log(res.ok ? `✓ Storefront cache refreshed (${site})` : `! Cache refresh failed: HTTP ${res.status}`);
}

/* ───────────────────────── deployed ───────────────────────── */

async function cmdDeployed() {
  const site = option("site") ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new Error("Usage: catalog deployed <slug…|--all> --site https://www.example.com");
  const slugs = flag("all") ? allSlugs() : positional();
  const lock = readLock();
  const files = slugs.flatMap((s) => (lock[s] ?? []).map((l) => l.file));
  const deadline = Date.now() + Number(option("timeout") ?? 600) * 1000;
  for (const file of files) {
    for (;;) {
      const res = await fetch(`${site.replace(/\/$/, "")}${file}`, { method: "HEAD" }).catch(() => null);
      if (res?.ok) break;
      if (Date.now() > deadline) throw new Error(`${file} is not live on ${site} yet`);
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
  console.log(`✓ ${files.length} image(s) are live on ${site}`);
}

/* ───────────────────────── report ───────────────────────── */

async function cmdReport() {
  const products = await db.product.findMany({
    include: { brand: true, variants: { where: { isActive: true } }, _count: { select: { images: true } } },
    orderBy: { name: "asc" },
  });
  const live = products.filter((p) => p.isActive);
  const specSlugs = new Set(allSlugs());
  const sections: { title: string; why: string; items: string[] }[] = [
    { title: "Live without images", why: "Shows a placeholder; source official images (image-curator).", items: live.filter((p) => !p._count.images).map((p) => p.slug) },
    { title: "Live, price above MRP", why: "Illegal to sell above MRP — fix MRP or price now.", items: live.flatMap((p) => p.variants.filter((v) => v.price > v.mrp).map((v) => `${p.slug} ${v.sku} (₹${rs(v.price)} > MRP ₹${rs(v.mrp)})`)) },
    { title: "Live, MRP not researched (MRP = price)", why: "No discount shown; confirm the brand MRP.", items: live.filter((p) => p.variants.length && p.variants.every((v) => v.mrp === v.price)).map((p) => p.slug) },
    { title: "Live, missing Legal Metrology details", why: "Manufacturer and country of origin must be displayed.", items: live.filter((p) => !p.manufacturerInfo || !p.countryOfOrigin).map((p) => p.slug) },
    { title: "Hidden but in stock", why: "Stock you could be selling online; complete details and publish.", items: products.filter((p) => !p.isActive && p.variants.some((v) => v.stock > 0)).map((p) => `${p.slug} (${p.variants.reduce((n, v) => n + v.stock, 0)} units)`) },
    { title: "Live and sold out", why: "Consider hiding, or restock.", items: live.filter((p) => !p.variants.some((v) => v.stock > 0)).map((p) => p.slug) },
    { title: "Live without a product file", why: "Export it so changes go through review: npm run catalog -- export <slug>.", items: live.filter((p) => !specSlugs.has(p.slug)).map((p) => p.slug) },
  ];
  if (flag("json")) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), counts: { products: products.length, live: live.length }, sections }, null, 2));
    return;
  }
  console.log(`Catalogue report — ${live.length} live of ${products.length} products\n`);
  for (const s of sections) {
    console.log(`${s.items.length ? "•" : "✓"} ${s.title}: ${s.items.length}${s.items.length ? ` — ${s.why}` : ""}`);
    for (const i of s.items.slice(0, 40)) console.log(`    ${i}`);
    if (s.items.length > 40) console.log(`    … and ${s.items.length - 40} more`);
  }
}

/* ───────────────────────── stock-plan ───────────────────────── */

async function cmdStockPlan() {
  const [file] = positional();
  if (!file) throw new Error("Usage: catalog stock-plan <sheet.csv>");
  const { rows, errors } = parseStockCsv(fs.readFileSync(file, "utf8"));
  const plan = await planStockImport(rows);
  const warnings: string[] = [];
  for (const u of plan.updates) {
    if (u.priceBefore && u.priceAfter < u.priceBefore * 0.8) warnings.push(`${u.sku}: price drops ${Math.round((1 - u.priceAfter / u.priceBefore) * 100)}% (₹${rs(u.priceBefore)} → ₹${rs(u.priceAfter)})`);
    if (u.priceAfter > u.priceBefore * 1.2 && u.priceBefore) warnings.push(`${u.sku}: price rises ${Math.round((u.priceAfter / u.priceBefore - 1) * 100)}%`);
  }
  const mrps = new Map((await db.productVariant.findMany({ where: { id: { in: plan.updates.map((u) => u.variantId) } }, select: { id: true, mrp: true } })).map((v) => [v.id, v.mrp]));
  for (const u of plan.updates) if (u.priceAfter > (mrps.get(u.variantId) ?? Infinity)) warnings.push(`${u.sku}: new price ₹${rs(u.priceAfter)} is above MRP ₹${rs(mrps.get(u.variantId)!)} (import raises MRP to match — check the box MRP)`);
  const summary = {
    rowsRead: rows.length,
    rowErrors: errors,
    changes: plan.updates.length,
    unchanged: plan.unchanged,
    newProducts: plan.newProducts,
    warnings,
    updates: plan.updates.map((u) => ({ product: u.productName, sku: u.sku, stock: `${u.stockBefore} → ${u.stockAfter}`, price: `₹${rs(u.priceBefore)} → ₹${rs(u.priceAfter)}`, reservedByOrders: u.reserved })),
  };
  if (flag("json")) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  console.log(`Stock sheet: ${rows.length} rows (${errors.length} unreadable). ${plan.updates.length} variant(s) change, ${plan.unchanged} unchanged.`);
  for (const u of summary.updates.slice(0, 60)) console.log(`  ${u.sku}  stock ${u.stock}  price ${u.price}${u.reservedByOrders ? `  (${u.reservedByOrders} held by open orders)` : ""}`);
  if (plan.newProducts.length) {
    console.log(`\n${plan.newProducts.length} new item(s) not in the catalogue (they need product files):`);
    for (const n of plan.newProducts) console.log(`  + ${n.name} — ${n.variants} variant(s), ${n.stock} in stock${n.existingProduct ? " (slug exists)" : ""}`);
  }
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ! ${w}`);
  }
  console.log("\nTo apply: Admin → Inventory → Import stock CSV (re-plans from the file before writing).");
}

/* ───────────────────────── main ───────────────────────── */

const commands: Record<string, () => unknown> = {
  new: cmdNew,
  export: cmdExport,
  validate: cmdValidate,
  images: cmdImages,
  apply: cmdApply,
  deployed: cmdDeployed,
  report: cmdReport,
  "stock-plan": cmdStockPlan,
};

async function main() {
  const run = commands[cmd ?? ""];
  if (!run) {
    console.log(fs.readFileSync(process.argv[1], "utf8").split("*/")[0].replace(/^\/\*\*?\n?/, "").replace(/^ \* ?/gm, ""));
    process.exitCode = cmd && cmd !== "help" ? 1 : 0;
    return;
  }
  await run();
}

main()
  .catch((e) => {
    console.error(`✗ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
