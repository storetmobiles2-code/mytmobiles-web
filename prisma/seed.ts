/**
 * Initial data load.
 *
 *   npx prisma db seed
 *
 * - Creates categories, store settings, homepage banners and the first admin
 *   account (from ADMIN_EMAIL / ADMIN_PASSWORD) if they don't exist.
 * - Imports the catalogue from catalog/stock-sheet.csv **only into an empty
 *   database**. Afterwards, stock & prices are maintained from the admin panel
 *   (Admin → Inventory → Import stock CSV), so re-running the seed never
 *   overwrites live inventory.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, scrypt } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseStockCsv } from "../src/lib/catalog/csv";
import { buildCatalog, KIND_META } from "../src/lib/catalog/build-catalog";
import { slugify } from "../src/lib/slug";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const ROOT = process.cwd();
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));

const CATEGORIES = [
  { slug: "smartphones", name: "Mobiles", description: "5G smartphones from Samsung, Redmi, Apple, OPPO, vivo and more.", sortOrder: 1 },
  { slug: "tablets", name: "Tablets", description: "Tablets for work, study and entertainment.", sortOrder: 2 },
  { slug: "smart-tvs", name: "Smart TVs", description: "HD, Full HD and 4K smart TVs.", sortOrder: 3 },
  { slug: "air-coolers", name: "Air Coolers", description: "Desert, personal and tower air coolers.", sortOrder: 4 },
  { slug: "audio", name: "Audio", description: "Earbuds and wireless audio.", sortOrder: 5 },
  { slug: "smartwatches", name: "Smartwatches", description: "Smartwatches and fitness wearables.", sortOrder: 6 },
  { slug: "laptops", name: "Laptops", description: "Laptops for home and office.", sortOrder: 7 },
  { slug: "printers", name: "Printers", description: "Ink tank and multifunction printers.", sortOrder: 8 },
];

function hashPassword(password: string): Promise<string> {
  const N = 131072, r = 8, p = 1;
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$")),
    ),
  );
}

async function seedCategories() {
  for (const c of CATEGORIES) {
    const hsn = Object.values(KIND_META).find((m) => m.category === c.slug)?.hsn;
    await db.category.upsert({ where: { slug: c.slug }, update: {}, create: { ...c, hsnCode: hsn, gstRateBps: 1800 } });
  }
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("! ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin account created.");
    return;
  }
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters.");
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") await db.user.update({ where: { email }, data: { role: "ADMIN" } });
    console.log(`= admin ${email} exists`);
    return;
  }
  await db.user.create({
    data: { email, name: "Store Admin", passwordHash: await hashPassword(password), role: "ADMIN", emailVerifiedAt: new Date() },
  });
  console.log(`+ admin ${email} created — sign in and change the password.`);
}

async function seedCatalog() {
  const count = await db.product.count();
  if (count > 0) {
    console.log(`= catalogue already has ${count} products — skipping import (use Admin → Inventory → Import stock CSV).`);
    return;
  }
  const { rows, errors } = parseStockCsv(fs.readFileSync(path.join(ROOT, "catalog/stock-sheet.csv"), "utf8"));
  if (errors.length) console.warn(`! ${errors.length} stock rows skipped`, errors.slice(0, 5));
  const { products, unparsed } = buildCatalog({
    rows,
    reference: readJson("catalog/reference.json").families,
    images: readJson("catalog/images.lock.json"),
    overrides: readJson("catalog/overrides.json").families,
  });
  if (unparsed.length) console.warn(`! ${unparsed.length} rows not recognised:`, unparsed.map((u) => u.name));

  const categories = new Map((await db.category.findMany()).map((c) => [c.slug, c.id]));
  const brandIds = new Map<string, string>();
  for (const name of [...new Set(products.map((p) => p.brand))].sort()) {
    const b = await db.brand.upsert({ where: { name }, update: {}, create: { name, slug: slugify(name) } });
    brandIds.set(name, b.id);
  }

  let n = 0;
  for (const p of products) {
    const cheapest = [...p.variants].sort((a, b) => a.price - b.price)[0];
    const discountPct = p.variants.reduce((m, v) => Math.max(m, v.mrp > v.price ? Math.floor(((v.mrp - v.price) / v.mrp) * 100) : 0), 0);
    await db.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        brandId: brandIds.get(p.brand)!,
        categoryId: categories.get(KIND_META[p.kind].category)!,
        condition: p.condition,
        shortDescription: p.shortDescription,
        description: p.description,
        highlights: p.highlights,
        specs: p.specs,
        keywords: p.keywords,
        boxContents: [],
        warranty: p.warranty,
        hsnCode: p.hsnCode,
        gstRateBps: p.gstRateBps,
        returnWindowDays: p.returnWindowDays,
        is5G: p.is5G,
        isActive: p.isActive,
        manufacturerInfo: p.manufacturerInfo,
        countryOfOrigin: p.countryOfOrigin,
        priceFrom: cheapest.price,
        mrpFrom: Math.max(cheapest.mrp, cheapest.price),
        discountPct,
        inStock: p.variants.some((v) => v.stock > 0),
        variants: {
          create: p.variants.map((v, i) => ({
            sku: v.sku,
            color: v.color,
            storage: v.storage,
            storageGb: v.storageGb,
            ram: v.ram,
            ramGb: v.ramGb,
            mrp: v.mrp,
            price: v.price,
            stock: v.stock,
            externalNames: v.externalNames,
            sortOrder: i,
            lowStockThreshold: 2,
          })),
        },
        images: {
          create: p.images.map((img, i) => ({
            url: img.file,
            alt: img.alt,
            color: img.color,
            width: img.width,
            height: img.height,
            sortOrder: i,
            sourceUrl: img.sourceUrl,
            credit: img.credit,
            license: img.license,
          })),
        },
      },
    });
    n++;
  }
  // Opening stock as an auditable inventory entry.
  const variants = await db.productVariant.findMany({ where: { stock: { gt: 0 } }, select: { id: true, stock: true } });
  await db.inventoryLog.createMany({ data: variants.map((v) => ({ variantId: v.id, delta: v.stock, reason: "Opening stock (catalog/stock-sheet.csv)" })) });
  console.log(`+ imported ${n} products (${products.filter((p) => p.isActive).length} live, rest hidden until restocked)`);
}

async function seedBanners() {
  if ((await db.banner.count()) > 0) return;
  const hero = async (slug: string) => (await db.product.findUnique({ where: { slug }, include: { images: { take: 1, orderBy: { sortOrder: "asc" } } } }))?.images[0]?.url ?? null;
  const banners = [
    { eyebrow: "New arrival", title: "Redmi Note 15 5G", subtitle: "Slim design, curved display. In stock now.", ctaLabel: "Shop Redmi Note 15", href: "/p/redmi-note-15-5g", imageUrl: await hero("redmi-note-15-5g"), imageAlt: "Redmi Note 15 5G", bgFrom: "#0f172a", bgTo: "#1e3a8a", sortOrder: 1 },
    { eyebrow: "Samsung Galaxy", title: "Galaxy A series, from A07 to A57", subtitle: "Pick the Galaxy that fits your budget.", ctaLabel: "Explore Samsung", href: "/brands/samsung", imageUrl: await hero("samsung-galaxy-a57-5g"), imageAlt: "Samsung Galaxy A57 5G", bgFrom: "#1b1446", bgTo: "#4f2edc", sortOrder: 2 },
    { eyebrow: "Open-box deals", title: "Demo units at lower prices", subtitle: "Display units from our store — limited pieces.", ctaLabel: "See open-box deals", href: "/open-box", imageUrl: await hero("samsung-galaxy-s26-demo-unit"), imageAlt: "Samsung Galaxy S26 demo unit", bgFrom: "#3b0764", bgTo: "#be185d", sortOrder: 3 },
  ];
  await db.banner.createMany({ data: banners.map((b) => ({ ...b, placement: "HERO" as const })) });
  console.log(`+ ${banners.length} banners`);
}

async function main() {
  await db.storeSettings.upsert({ where: { id: "store" }, update: {}, create: { id: "store" } });
  await seedCategories();
  await seedAdmin();
  await seedCatalog();
  await seedBanners();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
