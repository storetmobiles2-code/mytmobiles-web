/**
 * Turns the store's stock sheet into a structured catalogue:
 *   stock rows → (parse) → product families → variants
 * enriched with verified reference data (official images, MRPs, legal
 * disclosures) and curated overrides. Pure & deterministic so it can be
 * tested and re-run on every new stock export.
 */
import { parseStockName, titleCase, type CatalogKind, type ParsedStockName } from "./stock-parse";
import type { StockRow } from "./csv";
import { slugify } from "../slug";

export interface ReferenceFamily {
  brand: string;
  sourcePage: string;
  /** "ram/storage" (or "-/storage") → MRP in paise */
  mrp?: Record<string, number>;
  legal?: { manufacturer?: string; countryOfOrigin?: string };
}

export interface LockedImage {
  file: string;
  width: number;
  height: number;
  sourceUrl: string;
  sourcePage: string;
  credit: string;
  license: string;
}

export interface Override {
  name?: string;
  color?: string;
  colorAliases?: Record<string, string>;
  mergeInto?: string[];
  specs?: Record<string, string>;
}

export interface CatalogInputs {
  rows: StockRow[];
  reference: Record<string, ReferenceFamily>;
  images: Record<string, Record<string, LockedImage[]>>;
  overrides: Record<string, Override>;
}

export interface CatalogVariant {
  sku: string;
  color: string | null;
  storage: string | null;
  storageGb: number | null;
  ram: string | null;
  ramGb: number | null;
  price: number;
  mrp: number;
  stock: number;
  externalNames: string[];
}

export interface CatalogImage extends LockedImage {
  color: string | null;
  alt: string;
}

export interface CatalogProduct {
  familyKey: string;
  slug: string;
  name: string;
  brand: string;
  kind: CatalogKind;
  condition: "NEW" | "DEMO";
  is5G: boolean;
  isActive: boolean;
  shortDescription: string;
  description: string;
  highlights: string[];
  specs: { group: string; items: { label: string; value: string }[] }[];
  keywords: string[];
  warranty: string;
  returnWindowDays: number;
  hsnCode: string;
  gstRateBps: number;
  manufacturerInfo: string | null;
  countryOfOrigin: string | null;
  variants: CatalogVariant[];
  images: CatalogImage[];
}

export const KIND_META: Record<CatalogKind, { category: string; hsn: string; returnDays: number; noun: string }> = {
  phone: { category: "smartphones", hsn: "85171300", returnDays: 7, noun: "smartphone" },
  tablet: { category: "tablets", hsn: "84713010", returnDays: 7, noun: "tablet" },
  tv: { category: "smart-tvs", hsn: "85287217", returnDays: 7, noun: "smart TV" },
  "air-cooler": { category: "air-coolers", hsn: "84796000", returnDays: 7, noun: "air cooler" },
  audio: { category: "audio", hsn: "85183000", returnDays: 7, noun: "audio product" },
  watch: { category: "smartwatches", hsn: "85176290", returnDays: 7, noun: "smartwatch" },
  laptop: { category: "laptops", hsn: "84713010", returnDays: 7, noun: "laptop" },
  printer: { category: "printers", hsn: "84433290", returnDays: 7, noun: "printer" },
};

const BRAND_IN_NAME = new Set(["Redmi", "POCO"]);

function productName(p: ParsedStockName, anyFiveG: boolean, override?: Override): string {
  if (override?.name) return override.name;
  const model = anyFiveG && p.kind === "phone" && !/\b5G\b/.test(p.model) ? `${p.model} 5G` : p.model;
  return BRAND_IN_NAME.has(p.brand) ? `${p.brand} ${model}` : `${p.brand} ${model}`;
}

export function storageLabel(gb: number): string {
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;
}

function skuFor(slug: string, v: { ramGb: number | null; storageGb: number | null; color: string | null }): string {
  return [slug, v.ramGb, v.storageGb, v.color ? slugify(v.color) : null]
    .filter((x) => x !== null && x !== "")
    .join("-")
    .toUpperCase()
    .slice(0, 64);
}

function mrpFor(ref: ReferenceFamily | undefined, ramGb: number | null, storageGb: number | null): number | null {
  if (!ref?.mrp) return null;
  return ref.mrp[`${ramGb ?? "-"}/${storageGb ?? "-"}`] ?? null;
}

/** Images for a family colour; demo units reuse their retail model's verified images. */
function imagesFor(images: CatalogInputs["images"], familyKey: string, colors: (string | null)[], productLabel: string): CatalogImage[] {
  const set = images[familyKey];
  if (!set) return [];
  const out: CatalogImage[] = [];
  const wanted = new Set(colors.filter(Boolean) as string[]);
  for (const [color, list] of Object.entries(set)) {
    // Only include colours that this product actually stocks (or colourless images).
    const match = [...wanted].find((w) => w.toLowerCase() === color.toLowerCase());
    if (wanted.size && !match) continue;
    list.forEach((img, i) =>
      out.push({ ...img, color: match ?? null, alt: `${productLabel}${match ? ` in ${match}` : ""}${i > 0 ? ` — view ${i + 1}` : ""}` }),
    );
  }
  return out;
}

export function buildCatalog(input: CatalogInputs): { products: CatalogProduct[]; unparsed: StockRow[] } {
  // Resolve merge aliases: alias familyKey → canonical familyKey
  const alias = new Map<string, string>();
  for (const [key, o] of Object.entries(input.overrides)) for (const m of o.mergeInto ?? []) alias.set(m, key);

  const groups = new Map<string, { parsed: ParsedStockName; rows: { row: StockRow; p: ParsedStockName }[] }>();
  const unparsed: StockRow[] = [];
  for (const row of input.rows) {
    const p = parseStockName(row.name, row.category);
    if (!p) {
      unparsed.push(row);
      continue;
    }
    const familyKey = alias.get(p.familyKey) ?? p.familyKey;
    const key = `${p.isDemo ? "DEMO|" : ""}${familyKey}`;
    const g = groups.get(key) ?? { parsed: { ...p, familyKey }, rows: [] };
    g.rows.push({ row, p: { ...p, familyKey } });
    groups.set(key, g);
  }

  // 5G is a property of the model, not of a sheet row: demo rows often omit it.
  const fiveG = new Set<string>();
  for (const [, g] of groups) if (g.rows.some((r) => r.p.network === "5G")) fiveG.add(g.parsed.familyKey);

  const products: CatalogProduct[] = [];
  const usedSlugs = new Set<string>();
  for (const [, g] of groups) {
    const { parsed } = g;
    const familyKey = parsed.familyKey;
    const override = input.overrides[familyKey];
    const ref = input.reference[familyKey];
    const anyFiveG = fiveG.has(familyKey);
    const baseName = productName(parsed, anyFiveG, override);
    const isDemo = parsed.isDemo;
    const name = isDemo ? `${baseName} (Demo Unit)` : baseName;
    let slug = slugify(name);
    while (usedSlugs.has(slug)) slug = `${slug}-2`;
    usedSlugs.add(slug);

    // Merge duplicate rows into variants keyed by ram/storage/colour.
    const byVariant = new Map<string, { rows: StockRow[]; p: ParsedStockName }>();
    for (const { row, p } of g.rows) {
      let color = override?.color ?? p.color;
      if (color && override?.colorAliases?.[color]) color = override.colorAliases[color];
      const vp = { ...p, color };
      const vkey = `${p.ramGb}|${p.storageGb}|${(color ?? "").toLowerCase()}`;
      const v = byVariant.get(vkey) ?? { rows: [], p: vp };
      v.rows.push(row);
      byVariant.set(vkey, v);
    }

    const variants: CatalogVariant[] = [...byVariant.values()].map(({ rows, p }) => {
      const stock = rows.reduce((s, r) => s + r.quantity, 0);
      // Price: from an in-stock row if any (highest if several), else the highest listed.
      const priced = rows.filter((r) => r.quantity > 0);
      const price = Math.max(...(priced.length ? priced : rows).map((r) => r.price));
      const officialMrp = mrpFor(ref, p.ramGb, p.storageGb);
      return {
        sku: skuFor(slug, p),
        color: p.color,
        storage: p.storageGb ? storageLabel(p.storageGb) : null,
        storageGb: p.storageGb,
        ram: p.ramGb ? `${p.ramGb} GB` : null,
        ramGb: p.ramGb,
        price,
        // Never show an MRP lower than the selling price; without an official MRP, MRP = price (no invented discount).
        mrp: officialMrp && officialMrp >= price ? officialMrp : price,
        stock,
        externalNames: [...new Set(rows.map((r) => r.name))],
      };
    });
    variants.sort((a, b) => (a.storageGb ?? 0) - (b.storageGb ?? 0) || (a.ramGb ?? 0) - (b.ramGb ?? 0) || (a.color ?? "").localeCompare(b.color ?? ""));

    const meta = KIND_META[parsed.kind];
    const colors = [...new Set(variants.map((v) => v.color))];
    const images = imagesFor(input.images, familyKey, colors, baseName);
    const totalStock = variants.reduce((s, v) => s + v.stock, 0);
    const rams = [...new Set(variants.map((v) => v.ram).filter(Boolean))];
    const storages = [...new Set(variants.map((v) => v.storage).filter(Boolean))];

    const keyFacts: { label: string; value: string }[] = [
      { label: "Brand", value: parsed.brand },
      { label: "Model", value: baseName.replace(new RegExp(`^${parsed.brand}\\s+`), "") },
    ];
    if (rams.length) keyFacts.push({ label: "RAM options", value: rams.join(" / ") });
    if (storages.length) keyFacts.push({ label: "Storage options", value: storages.join(" / ") });
    if (parsed.kind === "phone" || parsed.kind === "tablet") keyFacts.push({ label: "Network", value: anyFiveG ? "5G" : parsed.network === "4G" ? "4G LTE" : "As per model" });
    if (colors.filter(Boolean).length) keyFacts.push({ label: "Colours", value: colors.filter(Boolean).join(", ") });
    for (const [label, value] of Object.entries(override?.specs ?? {})) keyFacts.push({ label, value });
    keyFacts.push({ label: "Condition", value: isDemo ? "Demo / display unit (open box)" : "Brand new" });

    const legal: { label: string; value: string }[] = [];
    if (ref?.legal?.manufacturer) legal.push({ label: "Manufacturer / Marketed by", value: ref.legal.manufacturer });
    if (ref?.legal?.countryOfOrigin) legal.push({ label: "Country of origin", value: ref.legal.countryOfOrigin });

    const highlights = [
      anyFiveG ? "5G connectivity" : null,
      rams.length && storages.length ? `${rams.join("/")} RAM · ${storages.join("/")} storage` : storages.length ? `${storages.join("/")} storage` : null,
      ...Object.entries(override?.specs ?? {}).slice(0, 2).map(([k, v]) => `${k}: ${v}`),
      isDemo ? "Demo unit — priced below new" : "GST invoice with every order",
    ].filter((x): x is string => Boolean(x));

    const shortDescription = isDemo
      ? `Demo (display) unit of the ${baseName}, sold open-box at a lower price.`
      : `Brand-new ${baseName}${colors.filter(Boolean).length > 1 ? ` in ${colors.filter(Boolean).length} colours` : ""}, with GST invoice from myT Mobiles.`;
    const description = isDemo
      ? `This is a demo (display) unit of the ${baseName} that was used for in-store demonstration. It may show light signs of handling. Please contact us before ordering if you'd like to know its exact condition, accessories included and remaining manufacturer warranty.`
      : `Buy the ${baseName} from myT Mobiles. Every order ships with a GST tax invoice, and you can choose Cash on Delivery or pay online. Prices shown include GST.`;

    products.push({
      familyKey,
      slug,
      name,
      brand: parsed.brand,
      kind: parsed.kind,
      condition: isDemo ? "DEMO" : "NEW",
      is5G: anyFiveG,
      isActive: totalStock > 0,
      shortDescription,
      description,
      highlights,
      specs: [{ group: "Key facts", items: keyFacts }, ...(legal.length ? [{ group: "Legal disclosures", items: legal }] : [])],
      keywords: [...new Set([parsed.brand, parsed.model, meta.noun, ...(anyFiveG ? ["5g"] : []), ...(isDemo ? ["demo", "open box"] : [])].flatMap((k) => k.toLowerCase().split(/\s+/)))],
      warranty: isDemo
        ? "Manufacturer warranty as applicable from the original activation date — ask us for the remaining period."
        : "Manufacturer warranty as per brand policy.",
      returnWindowDays: isDemo ? 0 : meta.returnDays,
      hsnCode: meta.hsn,
      gstRateBps: 1800,
      manufacturerInfo: ref?.legal?.manufacturer || null,
      countryOfOrigin: ref?.legal?.countryOfOrigin || null,
      variants,
      images,
    });
  }
  return { products: products.sort((a, b) => a.slug.localeCompare(b.slug)), unparsed };
}

export { titleCase };
