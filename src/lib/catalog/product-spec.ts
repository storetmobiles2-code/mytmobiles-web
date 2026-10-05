/**
 * Product spec files: catalog/products/<slug>.json
 *
 * The reviewable, version-controlled description of a product: details, legal
 * disclosures, variants with MRP, and official images with provenance. Agents
 * and staff edit these files in a pull request; `npm run catalog -- apply`
 * writes them to the database after review.
 *
 * Ownership:
 *   - Selling price and stock come from the shop's POS stock sheet (stock import).
 *     A spec only sets `price` for items that are not on the sheet.
 *   - MRP, details, specs, legal fields and images come from the spec, sourced
 *     from the manufacturer's official India website.
 *
 * Kept free of server-only imports so scripts and tests can use it.
 */
import { z } from "zod";

export const GST_RATES_PERCENT = [0, 5, 12, 18, 28, 40] as const;

/** Retailers and marketplaces whose images/listings must not be reused (rights unclear). */
export const BANNED_SOURCE_DOMAINS = [
  "amazon.", "amzn.", "media-amazon.", "flipkart.", "flixcart.", "bestbuy.", "croma.", "reliancedigital.", "relianceretail.",
  "vijaysales.", "tatacliq.", "snapdeal.", "meesho.", "myntra.", "jiomart.", "ebay.", "paytmmall.", "shopsy.", "poorvika.",
  "sangeethamobiles.", "bigc.", "lotmobiles.", "91mobiles.", "gsmarena.", "smartprix.", "pricebaba.",
];

const rupees = z.number().positive().max(10_000_000).multipleOf(0.01);
const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const url = z.url({ protocol: /^https$/, message: "Use an https URL" });

export const variantSpecSchema = z.object({
  sku: z.string().trim().min(3).max(64).regex(/^[A-Z0-9._-]+$/, "Upper-case letters, numbers, dot, dash or underscore"),
  color: z.string().trim().min(1).max(40).nullable().default(null),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().default(null),
  ramGb: z.number().int().min(1).max(64).nullable().default(null),
  storageGb: z.number().int().min(1).max(4096).nullable().default(null),
  /** Maximum retail price in rupees, from the brand's official India listing or the box. */
  mrp: rupees,
  /** Selling price in rupees. Omit to keep the POS stock-sheet price. */
  price: rupees.optional(),
  maxPerOrder: z.number().int().min(1).max(10).default(3),
  /** Exact item names on the POS stock sheet, so stock imports match this variant. */
  stockSheetNames: z.array(z.string().trim().min(3)).default([]),
});

export const imageSpecSchema = z.object({
  /** Colour this image shows; must match a variant colour. null = applies to all colours. */
  color: z.string().trim().min(1).nullable().default(null),
  /** Direct image URL on the manufacturer's (or an authorised) site. */
  url,
  /** Page the image was found on. */
  sourcePage: url,
  credit: z.string().trim().min(2).max(120),
  license: z.string().trim().min(10).max(500),
});

export const sourceSpecSchema = z.object({
  url,
  usedFor: z.array(z.enum(["details", "specs", "mrp", "images", "legal", "price"])).min(1),
  retrievedAt: z.iso.date(),
});

export const productSpecSchema = z.object({
  $schema: z.string().optional(),
  slug: z.string().regex(slugRe, "lower-case words separated by dashes").max(120),
  name: z.string().trim().min(3).max(160),
  brand: z.string().trim().min(1).max(60),
  /** Category slug, e.g. smartphones, tablets, smart-tvs, air-coolers, audio, smartwatches. */
  category: z.string().regex(slugRe),
  condition: z.enum(["NEW", "DEMO"]).default("NEW"),
  /** draft = leave visibility as is (new products start hidden); live = publish; hidden = unpublish. */
  status: z.enum(["draft", "live", "hidden"]).default("draft"),
  featured: z.boolean().default(false),
  is5G: z.boolean().default(false),
  launchedAt: z.iso.date().nullable().default(null),
  shortDescription: z.string().trim().min(10).max(300),
  description: z.string().trim().min(10).max(10_000),
  highlights: z.array(z.string().trim().min(2).max(160)).max(12).default([]),
  specs: z
    .array(z.object({ group: z.string().trim().min(1).max(60), items: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(300) })).min(1) }))
    .default([]),
  boxContents: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  keywords: z.array(z.string().trim().toLowerCase().min(2).max(40)).max(40).default([]),
  warranty: z.string().trim().max(300).nullable().default(null),
  /** Legal Metrology: manufacturer/packer/importer name and address. */
  manufacturerInfo: z.string().trim().min(5).max(500).nullable().default(null),
  countryOfOrigin: z.string().trim().min(2).max(60).nullable().default(null),
  hsnCode: z.string().regex(/^\d{4,8}$/, "HSN must be 4–8 digits"),
  gstRatePercent: z.literal([...GST_RATES_PERCENT]),
  returnWindowDays: z.number().int().min(0).max(30).default(7),
  seoTitle: z.string().trim().max(70).nullable().default(null),
  seoDescription: z.string().trim().max(170).nullable().default(null),
  variants: z.array(variantSpecSchema).min(1),
  /** Omit to leave the product's current images untouched. */
  images: z.array(imageSpecSchema).optional(),
  sources: z.array(sourceSpecSchema).default([]),
});

export type ProductSpec = z.infer<typeof productSpecSchema>;
export type VariantSpec = z.infer<typeof variantSpecSchema>;

export interface SpecProblem {
  level: "error" | "warning";
  path: string;
  message: string;
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "";
  }
};
export const isBannedSource = (u: string) => {
  const host = hostOf(u);
  return BANNED_SOURCE_DOMAINS.some((d) => host.includes(d));
};

/** Parses a spec and applies the store's business rules on top of the schema. */
export function checkSpec(raw: unknown, fileSlug?: string): { spec: ProductSpec | null; problems: SpecProblem[] } {
  const parsed = productSpecSchema.safeParse(raw);
  if (!parsed.success) {
    return { spec: null, problems: parsed.error.issues.map((i) => ({ level: "error", path: i.path.join("."), message: i.message })) };
  }
  const spec = parsed.data;
  const problems: SpecProblem[] = [];
  const err = (path: string, message: string) => problems.push({ level: "error", path, message });
  const warn = (path: string, message: string) => problems.push({ level: "warning", path, message });

  if (fileSlug && fileSlug !== spec.slug) err("slug", `File is named ${fileSlug}.json but slug is "${spec.slug}"`);
  const todo = JSON.stringify(spec).match(/[^"]{0,30}TODO[^"]{0,30}/g);
  if (todo) err("", `Unfinished placeholders: ${todo.slice(0, 3).map((t) => `"${t}"`).join(", ")}`);

  const skus = new Set<string>();
  const names = new Set<string>();
  const combos = new Set<string>();
  spec.variants.forEach((v, i) => {
    if (skus.has(v.sku)) err(`variants.${i}.sku`, `Duplicate SKU ${v.sku}`);
    skus.add(v.sku);
    const combo = `${v.color ?? ""}|${v.ramGb ?? ""}|${v.storageGb ?? ""}`;
    if (combos.has(combo)) err(`variants.${i}`, "Two variants have the same colour, RAM and storage");
    combos.add(combo);
    if (v.price !== undefined && v.price > v.mrp) err(`variants.${i}.price`, `Selling price ₹${v.price} is above MRP ₹${v.mrp}`);
    if (v.price !== undefined && v.price < v.mrp * 0.4) warn(`variants.${i}.price`, `Price is over 60% below MRP — double-check`);
    for (const n of v.stockSheetNames) {
      const k = n.toUpperCase().replace(/\s+/g, " ");
      if (names.has(k)) err(`variants.${i}.stockSheetNames`, `"${n}" is listed on two variants`);
      names.add(k);
    }
    if (!v.stockSheetNames.length && v.price === undefined) warn(`variants.${i}`, "No stock-sheet name and no price: this variant will have no price or stock until linked");
  });

  const colours = new Set(spec.variants.map((v) => v.color).filter(Boolean) as string[]);
  (spec.images ?? []).forEach((img, i) => {
    if (img.color && !colours.has(img.color)) err(`images.${i}.color`, `"${img.color}" is not a variant colour (${[...colours].join(", ") || "none"})`);
    if (isBannedSource(img.url) || isBannedSource(img.sourcePage)) err(`images.${i}`, `Retailer/marketplace images are not allowed (${hostOf(img.url)}). Use the manufacturer's site.`);
  });
  spec.sources.forEach((s, i) => {
    if (isBannedSource(s.url) && s.usedFor.some((u) => u !== "price")) err(`sources.${i}`, `Don't source details, MRP or images from retailers (${hostOf(s.url)})`);
  });

  const used = new Set(spec.sources.flatMap((s) => s.usedFor));
  if (!used.has("mrp")) warn("sources", 'No source marked "mrp" — record where the MRP came from');
  if (!used.has("specs") && spec.specs.length) warn("sources", 'No source marked "specs"');
  if (spec.images?.length && !used.has("images")) warn("sources", 'No source marked "images"');
  if (spec.gstRatePercent === 12 || spec.gstRatePercent === 28) warn("gstRatePercent", "12% and 28% slabs were folded into 5%/18%/40% in Sept 2025 — confirm with the accountant");

  const live = spec.status === "live";
  const need = (ok: boolean, path: string, message: string) => (ok ? null : live ? err(path, message) : warn(path, message));
  need(Boolean(spec.images?.length), "images", "Needs at least one verified official image to go live (or keep status draft)");
  need(spec.specs.length > 0, "specs", "Add a specifications table before going live");
  need(Boolean(spec.manufacturerInfo), "manufacturerInfo", "Manufacturer/importer name and address is a Legal Metrology declaration");
  need(Boolean(spec.countryOfOrigin), "countryOfOrigin", "Country of origin is a Legal Metrology declaration");
  if (live && spec.images?.length) {
    for (const c of colours) if (!spec.images.some((im) => im.color === c || im.color === null)) warn("images", `No image for colour "${c}" — shoppers will see another colour's photo`);
  }
  return { spec, problems };
}
