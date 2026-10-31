import { describe, expect, it } from "vitest";
import { parseStockName } from "@/lib/catalog/stock-parse";
import { parseStockCsv } from "@/lib/catalog/csv";
import { buildCatalog, KIND_META } from "@/lib/catalog/build-catalog";

describe("parseStockName", () => {
  it("parses Samsung RAM/storage/colour", () => {
    expect(parseStockName("SAMSUNG GALAXY A07 5G 6/128 LIGHT GREEN", "SAMSUNG MOBILES")).toMatchObject({
      brand: "Samsung", model: "Galaxy A07", ramGb: 6, storageGb: 128, color: "Light Green", network: "5G", kind: "phone", isDemo: false,
    });
  });
  it("adds the Galaxy prefix and normalises typos", () => {
    expect(parseStockName("SAMSUNG A14 5G 8/128 BLACK")?.model).toBe("Galaxy A14");
    expect(parseStockName("SAMSUNG GALAXY A56 5G 8/256 AWESOME LIOGHTGRAY")?.color).toBe("Awesome Light Gray");
    expect(parseStockName("APPLE IPHONE 13 MIDINGHT 128 GB")?.color).toBe("Midnight");
  });
  it("parses Apple storage and colour in either order", () => {
    expect(parseStockName("APPLE IPHONE 17 MIST BLUE 256 GB")).toMatchObject({ brand: "Apple", model: "iPhone 17", storageGb: 256, ramGb: null, color: "Mist Blue" });
    expect(parseStockName("APPLE IPHONE 14 PRO 128 GB GOLD")).toMatchObject({ model: "iPhone 14 Pro", storageGb: 128, color: "Gold" });
    expect(parseStockName("IPHONE 16 PRO DESERT TITANIUM 256 GB")).toMatchObject({ brand: "Apple", model: "iPhone 16 Pro", color: "Desert Titanium" });
  });
  it("detects demo units and charger-less boxes", () => {
    expect(parseStockName("SAMSUNG GALAXY S26 12/256 COBALT VIOLET DEMO UNIT")).toMatchObject({ isDemo: true, color: "Cobalt Violet" });
    expect(parseStockName("SAMSUNG GALAXY A17 5G 6/128 BLUE WITHOUT TA")).toMatchObject({ withoutCharger: true, color: "Blue" });
  });
  it("handles alternative memory formats", () => {
    expect(parseStockName("PHILIPS S7220 BLACK 8GB+256GB")).toMatchObject({ ramGb: 8, storageGb: 256 });
    expect(parseStockName("ONEPLUS 11R 5G SOLAR RED 18 GB RAM 512 GB ROM")).toMatchObject({ ramGb: 18, storageGb: 512 });
  });
  it("classifies non-phone categories", () => {
    expect(parseStockName("Voltas GRAND 72 Desert Cooler", "AIRCOOLERS")?.kind).toBe("air-cooler");
    expect(parseStockName("TCL S5500 (32 inch) Full HD LED Smart Google TV 2024 Edition", "SMART TVS")?.kind).toBe("tv");
    expect(parseStockName("SAMSUNG TAB A11+ 5G 6/128 GRAY")).toMatchObject({ kind: "tablet", model: "Galaxy Tab A11+" });
  });
  it("normalises Nothing and OnePlus model spellings to one family", () => {
    expect(parseStockName("NOTHING (3A ) PRO 8/256 GREY")?.familyKey).toBe(parseStockName("NOTHING 3A PRO 12/256 BLACK")?.familyKey);
    expect(parseStockName("ONEPLUS CE3 LITE 5G 8/128 CHROMATIC GRAY")?.familyKey).toBe(parseStockName("ONEPLUS NORD CE3 LITE 5G 8/256 PASTEL LIME")?.familyKey);
  });
  it("returns null for rows without an identifiable brand", () => {
    expect(parseStockName("8/256 STEALTH BLACK")).toBeNull();
  });
});

describe("parseStockName: accessories and keypad phones (T MOBILES company)", () => {
  it("classifies by the myBillBook category first", () => {
    const cases: [string, string, string][] = [
      ["APPLE 20W USB-C POWER ADAPTER", "ADAPTERS", "charger"],
      ["SAMSUNG USB CABLE TYPE-C TO TYPE-C", "CABLES", "cable"],
      ["XIAOMI POWER BANK 4i 20000mAh 33W SONIC CHARGE", "POWER BANKS", "power-bank"],
      ["boAt Stone 1010 14W Bluetooth v5.0 Speaker", "SPEAKERS AND SOUNDBARS", "speaker"],
      ["ECHO DOT 4th GEN SMART SPEAKER WITH ALEXA", "AMAZON ALEXA", "smart-home"],
      ["FIRE TV STICK WITH ALEXA VOICE REMOTE", "AMAZON ALEXA", "smart-home"],
      ["XIAOMI 360 HOME SECURITY CAMERA 1080P", "SECURITY CAMERAS", "security-camera"],
      ["PHILIPS BEARD TRIMMER SERIES 3000", "TRIMMERS", "grooming"],
      ["PEBBLE DIGIT002 WIRELESS KEYBOARD AND MOUSE COMBO", "KEYBOARDS", "keyboard"],
      ["boAt AIRDOPES 141 OR 148", "AIRPODS", "audio"],
      ["OnePlus Bullets Wireless Z3", "HEADPHONES", "audio"],
      ["ONPLUS NORD BUDS 3 PRO", "ONEPLUS NORD BUDS", "audio"],
      ["PEBBLE TRIO SPECIAL EDITION BT CALLING SMART WATCH", "SMART WATCHES", "watch"],
      ["SAMSUNG GURU 1200", "KEYPAD MOBILES", "feature-phone"],
      ["MOTOROLA A10v DUAL SIM KEYPAD MOBILE", "KEYPAD MOBILES", "feature-phone"],
    ];
    for (const [name, category, kind] of cases) expect(parseStockName(name, category)?.kind, name).toBe(kind);
  });
  it("classifies rows with an empty or brand-only category by name", () => {
    expect(parseStockName("XIAOMI 67W SONIC CHARGE 3.0 CHARGER COMBO")?.kind).toBe("charger");
    expect(parseStockName("XIAOMI 6A HYPER CHARE CABLE")?.kind).toBe("cable");
    expect(parseStockName("XIAOMI 2A FAST CHARGER WITH CABLE")?.kind).toBe("charger");
    expect(parseStockName("NOISE TWO HEADPHONES")?.kind).toBe("audio");
    expect(parseStockName("ONEPLUS NORD BUDS 3r")?.kind).toBe("audio");
    expect(parseStockName("fire bolt ninja call")).toMatchObject({ brand: "Fire-Boltt", kind: "watch" });
    expect(parseStockName("PHILIPS E2101C BLACK")?.kind).toBe("feature-phone");
    expect(parseStockName("PHILIPS E2102 BLACK", "PHILIPS")?.kind).toBe("feature-phone");
    expect(parseStockName("FIRE TV STICK WITH ALEXA VOICE REMOTE")?.kind).toBe("smart-home");
  });
  it("recognises accessory brands and their spellings", () => {
    const brands: [string, string][] = [
      ["BOAT AAVANTE BAR 950 SOUND BAR", "boAt"],
      ["FIREBOLT EMPEROR BT CALLING AMOLED SMART WATCH", "Fire-Boltt"],
      ["FIREBOLTT VOGUE BT CALLING SMARTWATCH", "Fire-Boltt"],
      ["Fire-Boltt Astra Luxury Stainless Steel Smart Watch", "Fire-Boltt"],
      ["ZEBRINICS WIRE LESS HEADPHONES SILENCIO 200T", "Zebronics"],
      ["GOBOULT Crown Pro Smart Watch 2.01'' AMOLED, BT Calling", "Boult"],
      ["Boult Bassbox X120 with Subwoofer 12OW", "Boult"],
      ["beatXP WAVE XPODS", "beatXP"],
      ["MI QUALCOMM QUICK CHARGE 3.0", "Xiaomi"],
      ["ONPLUS NORD BUDS 3 PRO", "OnePlus"],
      ["ECHO DOT 4th GEN SMART SPEAKER WITH ALEXA", "Amazon"],
      ["ITEL POWER 410", "itel"],
      ["KECHAODA K9", "Kechaoda"],
      ["HMD 150 MUSIC DUAL SIM", "HMD"],
    ];
    for (const [name, brand] of brands) expect(parseStockName(name)?.brand, name).toBe(brand);
    expect(parseStockName("CMF NOTHING 65W GAN CHARGER")).toMatchObject({ brand: "CMF by Nothing", model: "65W Gan Charger" });
  });
  it("doesn't read accessory names as RAM/storage or colours", () => {
    expect(parseStockName("GOVO GOSURROUND 900 | 200W 2.1 SOUNDBAR SYSTEM WITH WIRED SUBWOOFER", "SPEAKERS AND SOUNDBARS")).toMatchObject({ color: null, ramGb: null });
    expect(parseStockName("Nothing 33W Type C Fast Charger (Adapter Only, White)", "ADAPTERS")?.model).not.toMatch(/Phone/);
    expect(parseStockName("Fire-Boltt Snapp Smart Watch, Selfie Camera, 4G Nano-SIM Slot 2/16 GB", "SMART WATCHES")).toMatchObject({ ramGb: 2, storageGb: 16 });
  });
  it("groups Philips keypad phones by model with the colour split off", () => {
    expect(parseStockName("PHILIPS E2112S COOL GRAY", "KEYPAD MOBILES")).toMatchObject({ model: "E2112s", color: "Cool Gray" });
    expect(parseStockName("PHILIPS E2102 COOL GRY", "KEYPAD MOBILES")?.color).toBe("Cool Gray");
    expect(parseStockName("PHILIPS E2101C BLACK")?.familyKey).toBe(parseStockName("PHILIPS E2101C ORANGE", "KEYPAD MOBILES")?.familyKey);
    expect(parseStockName("KARBONN BHARAT K1 4G", "KEYPAD MOBILES")?.model).toBe("Bharat K1 4G");
  });
  it("gives every kind a category, HSN code and GST rate", () => {
    for (const [kind, m] of Object.entries(KIND_META)) {
      expect(m.hsn, kind).toMatch(/^\d{6,8}$/);
      expect([500, 1800, 4000], kind).toContain(m.gstRateBps);
      expect(m.category, kind).toMatch(/^[a-z-]+$/);
    }
  });
});

describe("parseStockCsv", () => {
  it("parses quoted multi-line names and PCS quantities", () => {
    const csv = 'Name,Selling Price,Stock Quantity,Item Category Name\n"REDMI NOTE 13 5G\n  8/256 STEALTH BLACK",16999,0.0 PCS,MI DISTRIBUTOR\nAPPLE AIRPODS 4TH GEN,12900,1.0 PCS,APPLE DISTRIBUTOR\n';
    const { rows, errors } = parseStockCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "REDMI NOTE 13 5G 8/256 STEALTH BLACK", price: 1699900, quantity: 0 });
    expect(rows[1]).toMatchObject({ price: 1290000, quantity: 1 });
  });
  it("rejects files without the required columns", () => {
    expect(parseStockCsv("foo,bar\n1,2").errors[0].message).toMatch(/Header/);
  });
});

describe("buildCatalog", () => {
  const rows = parseStockCsv(
    [
      "Name,Selling Price,Stock Quantity,Item Category Name",
      "SAMSUNG GALAXY A17 5G 6/128 BLACK,19499,0.0 PCS,SAMSUNG MOBILES",
      "SAMSUNG GALAXY A17 5G 6/128 BLACK WITHOUT TA,27999,1.0 PCS,SAMSUNG MOBILES",
      "SAMSUNG GALAXY A17 5G 6/128 GRAY DEMO UNIT,18999,1.0 PCS,DEMO PHONES",
      "SAMSUNG GALAXY A03s 4/64 BLACK,11499,0.0 PCS,SAMSUNG MOBILES",
    ].join("\n"),
  ).rows;
  const { products } = buildCatalog({
    rows,
    reference: { "SAMSUNG|GALAXY A17": { brand: "Samsung", sourcePage: "x", mrp: { "6/128": 3899900 } } },
    images: {},
    overrides: {},
  });
  it("merges duplicate sheet rows into one variant, keeping the in-stock price", () => {
    const a17 = products.find((p) => p.name === "Samsung Galaxy A17 5G")!;
    expect(a17.variants).toHaveLength(1);
    expect(a17.variants[0]).toMatchObject({ price: 2799900, stock: 1, mrp: 3899900 });
    expect(a17.variants[0].externalNames).toHaveLength(2);
  });
  it("separates demo units into their own product", () => {
    const demo = products.find((p) => p.condition === "DEMO")!;
    expect(demo.name).toBe("Samsung Galaxy A17 5G (Demo Unit)");
    expect(demo.returnWindowDays).toBe(0);
  });
  it("hides families with no stock and never invents an MRP", () => {
    const old = products.find((p) => p.name.includes("A03s"))!;
    expect(old.isActive).toBe(false);
    expect(old.variants[0].mrp).toBe(old.variants[0].price);
  });
});

describe("buildCatalog: accessories", () => {
  const { products, unparsed } = buildCatalog({
    rows: parseStockCsv(
      [
        "Name,Selling Price,Stock Quantity,Item Category Name",
        "SAMSUNG 45W POWER ADAPTER,2999,15.0 PCS,ADAPTERS",
        "PHILIPS E2112S COOL GRAY,1749,1.0 PCS,KEYPAD MOBILES",
        "PHILIPS E2112S BLACK,1749,0.0 PCS,KEYPAD MOBILES",
        "XIAOMI 67W SONIC CHARGE 3.0 CHARGER COMBO,0,1.0 PCS,",
      ].join("\n"),
    ).rows,
    reference: {},
    images: {},
    overrides: {},
  });
  it("puts accessories and keypad phones in their own categories, with the kind's HSN and GST", () => {
    expect(unparsed).toEqual([]);
    const charger = products.find((p) => p.kind === "charger")!;
    expect(charger).toMatchObject({ name: "Samsung 45W Power Adapter", hsnCode: KIND_META.charger.hsn, gstRateBps: 1800, is5G: false });
    const keypad = products.find((p) => p.kind === "feature-phone")!;
    expect(keypad.name).toBe("Philips E2112s");
    expect(keypad.variants.map((v) => v.color)).toEqual(["Black", "Cool Gray"]);
  });
  it("never makes a product live from a ₹0 sheet price", () => {
    expect(products.find((p) => p.name.includes("67W"))).toMatchObject({ kind: "charger", isActive: false });
  });
});
