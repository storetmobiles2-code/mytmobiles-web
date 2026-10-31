/**
 * Parses free-text item names from the store's stock sheet (POS / Google Sheets
 * export) into structured catalogue fields, e.g.
 *
 *   "SAMSUNG GALAXY A07 5G 6/128 LIGHT GREEN"  →  Samsung · Galaxy A07 5G · 6 GB / 128 GB · Light Green
 *   "APPLE IPHONE 17 MIST BLUE 256 GB"         →  Apple · iPhone 17 · 256 GB · Mist Blue
 *   "REDMI NOTE 15 8/128 BLACK DEMO PHONE"     →  Redmi · Note 15 · demo unit
 *
 * Used by the initial catalogue build and by the admin stock import, so a
 * new export can be matched and applied without retyping products.
 */

export type CatalogKind =
  | "phone"
  | "feature-phone"
  | "tablet"
  | "tv"
  | "air-cooler"
  | "audio"
  | "watch"
  | "laptop"
  | "printer"
  | "charger"
  | "cable"
  | "power-bank"
  | "speaker"
  | "smart-home"
  | "security-camera"
  | "grooming"
  | "keyboard";

export interface ParsedStockName {
  brand: string;
  /** Model without brand, network suffix normalised, e.g. "Galaxy A07 5G" */
  model: string;
  /** Model family key used to group variants (brand + model, upper-case) */
  familyKey: string;
  kind: CatalogKind;
  ramGb: number | null;
  storageGb: number | null;
  color: string | null;
  isDemo: boolean;
  /** "WITHOUT TA" = sold without travel adapter (charger) */
  withoutCharger: boolean;
  /** Whether the model name carries an explicit network token */
  network: "5G" | "4G" | null;
}

/** Common typos seen in the sheet. Applied on word boundaries. */
const TYPOS: Record<string, string> = {
  MIDINGHT: "MIDNIGHT",
  WHTE: "WHITE",
  LIOGHTGRAY: "LIGHT GRAY",
  LIGHTGRAY: "LIGHT GRAY",
  VOILET: "VIOLET",
  SLIVER: "SILVER",
  TOMADO: "TORNADO",
  ULTRAMINE: "ULTRAMARINE",
  GREEHER: "GREENER",
  MARSHMELLO: "MARSHMALLOW",
  ICEBLUE: "ICE BLUE",
  ICYBLUE: "ICY BLUE",
  GRAYGREEN: "GRAY GREEN",
  SKYBLUE: "SKY BLUE",
  "S23FE": "S23 FE",
  "S21FE": "S21 FE",
  IQZ9X: "IQOO Z9X",
};

const BRAND_PREFIXES: [RegExp, string][] = [
  [/^APPLE\b/, "Apple"],
  [/^(IPHONE|IPAD)\b/, "Apple"],
  [/^SAMSUNG\b/, "Samsung"],
  [/^REDMI\b/, "Redmi"],
  [/^XIAOMI\b/, "Xiaomi"],
  [/^POCO\b/, "POCO"],
  [/^(VIVO\b|V\d{2}E?\b|Y\d{2,3}[A-Z]?\b)/, "vivo"],
  [/^IQOO\b/, "iQOO"],
  [/^OPPO\b/, "OPPO"],
  [/^(ONE ?PLUS|ONPLUS)\b/, "OnePlus"],
  [/^(REALME|NARZO)\b/, "realme"],
  [/^(MOTO|MOTOROLA)\b/, "Motorola"],
  [/^MI\b/, "Xiaomi"],
  [/^NOTHING\b/, "Nothing"],
  [/^CMF\b/, "CMF by Nothing"],
  [/^GOOGLE\b/, "Google"],
  [/^INFINIX\b/, "Infinix"],
  [/^PHILIPS\b/, "Philips"],
  [/^HP\b/, "HP"],
  [/^CELLECOR\b/, "Cellecor"],
  [/^TCL\b/, "TCL"],
  [/^FASTRACK\b/, "Fastrack"],
  [/^CROMPTON\b/, "Crompton"],
  [/^VOLTAS\b/, "Voltas"],
  [/^ORIENT\b/, "Orient Electric"],
  [/^KENSTAR\b/, "Kenstar"],
  [/^BAJAJ\b/, "Bajaj"],
  [/^BLUESTAR\b/, "Blue Star"],
  [/^HINDWARE\b/, "Hindware"],
  [/^LIVPURE\b/, "Livpure"],
  [/^SYMPHONY\b/, "Symphony"],
  // Accessories and keypad phones (the T MOBILES company in myBillBook)
  [/^BOAT\b/, "boAt"],
  [/^FIRE[- ]?BOLT{1,2}\b/, "Fire-Boltt"],
  [/^PEBBLE\b/, "Pebble"],
  [/^NOISE\b/, "Noise"],
  [/^(ZEBRONICS|ZEBRINICS)\b/, "Zebronics"],
  [/^JBL\b/, "JBL"],
  [/^(GO ?BOULT|BOULT)\b/, "Boult"],
  [/^HAMMER\b/, "Hammer"],
  [/^INTEX\b/, "Intex"],
  [/^BLAUPUNKT\b/, "Blaupunkt"],
  [/^GOVO\b/, "GOVO"],
  [/^MIVI\b/, "Mivi"],
  [/^STUFFCOOL\b/, "Stuffcool"],
  [/^GIZMORE\b/, "Gizmore"],
  [/^SKULLCANDY\b/, "Skullcandy"],
  [/^BEATXP\b/, "beatXP"],
  [/^SHKOD\b/, "SHKOD"],
  [/^TAGG\b/, "Tagg"],
  [/^MINIX\b/, "Minix"],
  [/^HMD\b/, "HMD"],
  [/^NOKIA\b/, "Nokia"],
  [/^LAVA\b/, "Lava"],
  [/^KARBONN\b/, "Karbonn"],
  [/^ITEL\b/, "itel"],
  [/^KECHAODA\b/, "Kechaoda"],
  [/^MICROMAX\b/, "Micromax"],
  [/^(AMAZON|ECHO|FIRE TV)\b/, "Amazon"],
  [/^GM\b/, "GM"],
];

/** Tokens to strip from the start of the model once the brand is known. */
const BRAND_TOKENS =
  /^(APPLE|SAMSUNG|XIAOMI|MI|VIVO|IQOO|OPPO|ONE ?PLUS|ONPLUS|REALME|MOTOROLA|MOTO|CMF NOTHING|NOTHING|GOOGLE|INFINIX|PHILIPS|HP|CELLECOR|TCL|FASTRACK|CROMPTON|VOLTAS|ORIENT|KENSTAR|BAJAJ|BLUESTAR|HINDWARE|LIVPURE|SYMPHONY|BOAT|FIRE[- ]?BOLT{1,2}|PEBBLE|NOISE|ZEBRONICS|ZEBRINICS|JBL|GO ?BOULT|BOULT|HAMMER|INTEX|BLAUPUNKT|GOVO|MIVI|STUFFCOOL|GIZMORE|SKULLCANDY|BEATXP|SHKOD|TAGG|MINIX|HMD|NOKIA|LAVA|KARBONN|ITEL|KECHAODA|MICROMAX|AMAZON|GM)\s+/;

const SMALL_WORDS = new Set(["and", "of", "the", "with", "for", "in"]);

/** Title-cases sheet text while preserving model-ish tokens (5G, A07, 4K, S26, Pro+). */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w, i) => {
      if (/\d/.test(w) && /^[a-z]*\d/.test(w)) return w.toUpperCase().replace(/(\d)X$/, "$1x").replace(/(\d)S$/, "$1s").replace(/(\d)E$/, "$1e").replace(/(\d)C$/, "$1C");
      if (/^(hd|uhd|qled|led|lte|tv|ai|fe|mfp|bt|gtv|ii|iii)$/.test(w)) return w.toUpperCase();
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** Brand-specific model casing. */
function prettyModel(brand: string, modelUpper: string): string {
  let m = titleCase(modelUpper);
  m = m.replace(/\bIphone\b/g, "iPhone").replace(/\bIpad\b/g, "iPad").replace(/\bIqoo\b/g, "iQOO");
  m = m.replace(/\bPro\+/g, "Pro+").replace(/\bPlus\b/g, "Plus");
  if (brand === "Motorola") m = m.replace(/^Moto /, "moto ").replace(/^Edge/, "edge").replace(/\bG(\d+)/, "g$1");
  if (brand === "Nothing" || brand === "CMF by Nothing") m = m.replace(/^Phone \((\w+)\)/i, (_, x) => `Phone (${x.toLowerCase()})`);
  return m;
}

/** POS (myBillBook) category names → kind. Checked before the item name. */
const CATEGORY_KINDS: [RegExp, CatalogKind][] = [
  [/KEYPAD|FEATURE PHONE/, "feature-phone"],
  [/AIR ?COOLER/, "air-cooler"],
  [/SMART TV/, "tv"],
  [/WATCH/, "watch"],
  [/LAPTOP/, "laptop"],
  [/PRINTER/, "printer"],
  [/ADAPTER|ADAPTOR|CHARGER/, "charger"],
  [/CABLE/, "cable"],
  [/POWER ?BANK/, "power-bank"],
  [/SPEAKER|SOUND ?BAR/, "speaker"],
  [/ALEXA|SMART HOME|STREAMING/, "smart-home"],
  [/SECURITY|CCTV/, "security-camera"],
  [/TRIMMER|GROOMING/, "grooming"],
  [/KEYBOARD|MOUSE/, "keyboard"],
  [/AIRPODS|HEADPHONE|EARPHONE|EARBUDS|\bBUDS\b|NECKBAND/, "audio"],
];

/** Item names → kind, for rows whose category says nothing (empty, a brand or a distributor). Order matters. */
const NAME_KINDS: [RegExp, CatalogKind][] = [
  [/\bCOOLER\b/, "air-cooler"],
  [/\b(ECHO|ALEXA|FIRE TV)\b/, "smart-home"],
  [/\bSECURITY CAMERA\b|\bCCTV\b/, "security-camera"],
  [/\b(TV|TELEVISION)\b/, "tv"],
  [/\b(SMART ?WATCH|WATCH)\b/, "watch"],
  [/\bLAPTOP\b/, "laptop"],
  [/\bPRINTER\b/, "printer"],
  [/\b(KEYPAD|FEATURE PHONE)\b/, "feature-phone"],
  [/\bPOWER ?BANK\b/, "power-bank"],
  // "FAST CHARGER WITH CABLE" is a charger; a cable on its own says CABLE without CHARGER/ADAPTER.
  [/\b(CHARGER|ADAPTER|ADAPTOR)\b/, "charger"],
  [/\bCABLE\b/, "cable"],
  [/\b(SOUND ?BAR|SPEAKER|HOME THEATRE|SUBWOOFER)\b/, "speaker"],
  [/\b(TRIMMER|SHAVER|GROOMING)\b/, "grooming"],
  [/\b(KEYBOARD|MOUSE)\b/, "keyboard"],
  [/\b(AIRPODS|EARPODS|AIRDOPES|BUDS|EARBUDS|HEADPHONES?|EARPHONES?|HEADSET|NECKBAND|BULLETS)\b/, "audio"],
];

/** Keypad phone model codes when the name doesn't say "keypad". */
const FEATURE_PHONE_MODEL = /^(PHILIPS E\d{4}|SAMSUNG GURU|NOKIA 1\d{2}\b|HMD 1\d{2}\b|LAVA (A\d|GEM|HERO)|KARBONN (K\d|BHARAT|JUMBO)|ITEL (\d{4}|POWER)|KECHAODA|MICROMAX J\d)/;

/** Brands that only make one kind of product the shop stocks. */
const BRAND_KINDS: Record<string, CatalogKind> = { "Fire-Boltt": "watch" };

function classify(brand: string, upper: string, sheetCategory: string): CatalogKind {
  const cat = sheetCategory.toUpperCase();
  const byCategory = CATEGORY_KINDS.find(([re]) => re.test(cat));
  if (byCategory) return byCategory[1];
  const byName = NAME_KINDS.find(([re]) => re.test(upper));
  if (byName) return byName[1];
  if (FEATURE_PHONE_MODEL.test(upper)) return "feature-phone";
  if (/\b(IPAD|TAB|PAD)\b/.test(upper) || /\bTAB A\d/.test(upper)) return "tablet";
  return BRAND_KINDS[brand] ?? "phone";
}

/** Kinds whose names carry RAM/storage ("8/128", "2/16 GB"). Accessories don't. */
const HAS_MEMORY = new Set<CatalogKind>(["phone", "tablet", "watch", "laptop", "feature-phone"]);

export function normaliseSheetName(raw: string): string {
  let s = raw.toUpperCase().replace(/[“”"]/g, '"').replace(/\s+/g, " ").trim();
  for (const [bad, good] of Object.entries(TYPOS)) s = s.replace(new RegExp(`\\b${bad.replace(/[+]/g, "\\+")}\\b`, "g"), good);
  // "(3A )" → "(3A)"
  s = s.replace(/\(\s*/g, "(").replace(/\s*\)/g, ")");
  return s;
}

/** Parses one stock-sheet item name. Returns null when the brand can't be identified. */
export function parseStockName(rawName: string, sheetCategory = ""): ParsedStockName | null {
  // A literal "|" in a name is a separator ("GOVO GOSURROUND 900 | 200W …"); "|" below marks where RAM/storage was.
  let s = normaliseSheetName(rawName).replace(/\s*\|\s*/g, " ");

  const isDemo = /\bDEMO( UNIT| PHONE)?\b/.test(s);
  s = s.replace(/\bDEMO( UNIT| PHONE)?\b/g, " ");
  const withoutCharger = /\bWITHOUT TA\b/.test(s);
  s = s.replace(/\bWITHOUT TA\b/g, " ").replace(/\s+/g, " ").trim();

  const brandEntry = BRAND_PREFIXES.find(([re]) => re.test(s));
  if (!brandEntry) return null;
  const brand = brandEntry[1];
  const kind = classify(brand, s, sheetCategory);

  // Memory: "8/256", "8/256GB", "8GB+256GB", "18 GB RAM 512 GB ROM", "4/128 GB"
  let ramGb: number | null = null;
  let storageGb: number | null = null;
  const memPatterns: RegExp[] = [
    /\b(\d{1,2})\s*GB\s*\+\s*(\d{2,4})\s*GB\b/,
    /\b(\d{1,2})\s*GB RAM\s*(\d{2,4})\s*GB ROM\b/,
    /\b(\d{1,2})\/(\d{2,4})\s*(GB)?\b/,
  ];
  if (HAS_MEMORY.has(kind)) {
    for (const re of memPatterns) {
      const m = s.match(re);
      if (m) {
        ramGb = Number(m[1]);
        storageGb = Number(m[2]);
        s = s.replace(m[0], " | ");
        break;
      }
    }
  }

  // Apple & storage-only names: "256 GB", "128GB", "1 TB"
  if (storageGb === null && (kind === "phone" || kind === "tablet")) {
    const m = s.match(/\b(\d{2,4})\s*(GB|TB)\b/);
    if (m) {
      storageGb = Number(m[1]) * (m[2] === "TB" ? 1024 : 1);
      s = s.replace(m[0], " ");
    }
  }
  s = s.replace(/\s+/g, " ").trim();

  let modelPart: string;
  let colorPart = "";
  if (brand === "Apple" && (kind === "phone" || kind === "tablet")) {
    const body = s.replace(/^APPLE\s+/, "");
    const m =
      body.match(/^(IPHONE \d+[A-Z]?(?: PRO MAX| PRO| PLUS| MINI)?)\b(.*)$/) ??
      body.match(/^(IPAD (?:\(?\d+(?:TH|RD|ND|ST) GEN(?:ERATION)?\)?|11 INCH A16|AIR|MINI|PRO)(?: WIFI(?:\+CELLULAR)?)?)\b(.*)$/);
    modelPart = m ? m[1] : body;
    colorPart = m ? m[2] : "";
    modelPart = modelPart.replace(/\(9TH GENERATION\)|9TH GEN/, "(9TH GEN)").replace(/\s+WIFI/, " WI-FI");
  } else if (s.includes("|")) {
    const [before, after] = s.split("|").map((x) => x.trim());
    modelPart = before.replace(BRAND_TOKENS, "");
    colorPart = after;
  } else if (kind === "phone" || kind === "tablet") {
    // No memory token (e.g. "REDMI NOTE 12 PRO 5G GLACIER BLUE"): colour can't be separated reliably.
    modelPart = s.replace(BRAND_TOKENS, "");
  } else if (brand === "Philips" && kind === "feature-phone" && /^PHILIPS E\d{4}[A-Z]?\s+\S/.test(s)) {
    // Philips keypad phones: "PHILIPS E2112S COOL GRAY" → model E2112S, colour Cool Gray
    const m = s.match(/^PHILIPS (E\d{4}[A-Z]?)\s+(.+)$/)!;
    modelPart = m[1];
    colorPart = m[2].replace(/\bGRY\b/, "GRAY");
  } else {
    modelPart = s.replace(BRAND_TOKENS, "");
  }

  // Samsung: ensure the Galaxy prefix ("SAMSUNG A14 5G" → "GALAXY A14 5G", "TAB A11+" → "GALAXY TAB A11+")
  if (brand === "Samsung" && !/^GALAXY\b/.test(modelPart) && /^(A|M|F|S|Z|TAB)\s?\d|^TAB\b/.test(modelPart)) modelPart = `GALAXY ${modelPart}`;
  // OnePlus "CE3 LITE" → "NORD CE3 LITE"; "NORD CE 3" → "NORD CE3"
  if (brand === "OnePlus") modelPart = modelPart.replace(/^CE\s?(\d)/, "NORD CE$1").replace(/NORD CE (\d)/, "NORD CE$1");
  // Nothing: "(3A) PRO" / "3A PRO" → "PHONE (3A) PRO"
  if (brand === "Nothing" && kind === "phone") modelPart = modelPart.replace(/^(?:PHONE\s*)?\(?(\d+[A-Z]?)\)?/, "PHONE ($1)");
  if (brand === "iQOO") modelPart = modelPart.replace(/^IQOO\s+/, "");
  if (brand === "realme") modelPart = modelPart.replace(/^REALME\s+/, "");
  if (brand === "Redmi" && !modelPart.startsWith("REDMI")) modelPart = modelPart; // already stripped by BRAND_TOKENS? keep
  modelPart = modelPart.replace(/^REDMI\s+/, "").replace(/^POCO\s+/, "");

  // Network token
  let network: ParsedStockName["network"] = null;
  if (/\b5G\+?\b/.test(modelPart)) network = "5G";
  else if (/\b(4G|LTE)\b/.test(modelPart)) network = "4G";
  modelPart = modelPart.replace(/\b(5G\+?|4G|LTE)\b/g, " ").replace(/\s+/g, " ").trim();

  const color = colorPart.replace(/\bCOLOU?R\b/g, "").replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  const modelUpper = network === "4G" && (kind === "phone" || kind === "feature-phone") ? `${modelPart} 4G` : modelPart;
  const model = prettyModel(brand, modelUpper);

  return {
    brand,
    model,
    familyKey: `${brand.toUpperCase()}|${modelUpper}`,
    kind,
    ramGb,
    storageGb,
    color: color ? titleCase(color) : null,
    isDemo,
    withoutCharger,
    network,
  };
}
