import { describe, expect, it } from "vitest";
import { parseStockName } from "@/lib/catalog/stock-parse";
import { parseStockCsv } from "@/lib/catalog/csv";
import { buildCatalog } from "@/lib/catalog/build-catalog";

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
