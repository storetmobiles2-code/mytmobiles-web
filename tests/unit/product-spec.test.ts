import { describe, expect, it } from "vitest";
import { checkSpec, isBannedSource } from "@/lib/catalog/product-spec";

const base = {
  slug: "samsung-galaxy-a57-5g",
  name: "Samsung Galaxy A57 5G",
  brand: "Samsung",
  category: "smartphones",
  status: "draft",
  shortDescription: "A 5G phone with a big battery.",
  description: "Longer description of the phone for shoppers.",
  specs: [{ group: "Display", items: [{ label: "Size", value: "6.7 inch" }] }],
  manufacturerInfo: "Samsung India Electronics Pvt. Ltd., New Delhi",
  countryOfOrigin: "India",
  hsnCode: "85171300",
  gstRatePercent: 18,
  variants: [{ sku: "SM-A57-8-256-NAVY", color: "Awesome Navy", ramGb: 8, storageGb: 256, mrp: 44999, stockSheetNames: ["SAMSUNG A57 5G 8/256 NAVY"] }],
  images: [{ color: "Awesome Navy", url: "https://images.samsung.com/a57-navy.png", sourcePage: "https://www.samsung.com/in/smartphones/galaxy-a57/buy/", credit: "© Samsung Electronics", license: "Official manufacturer image, used unmodified." }],
  sources: [{ url: "https://www.samsung.com/in/smartphones/galaxy-a57/buy/", usedFor: ["details", "specs", "mrp", "images", "legal"], retrievedAt: "2026-10-05" }],
};
const errors = (raw: unknown, slug?: string) => checkSpec(raw, slug).problems.filter((p) => p.level === "error").map((p) => `${p.path}: ${p.message}`);

describe("product spec rules", () => {
  it("accepts a complete spec", () => {
    expect(errors(base, "samsung-galaxy-a57-5g")).toEqual([]);
    expect(checkSpec(base).spec?.variants[0].maxPerOrder).toBe(3);
  });

  it("rejects a selling price above MRP", () => {
    expect(errors({ ...base, variants: [{ ...base.variants[0], price: 45999 }] }).join()).toMatch(/above MRP/);
  });

  it("rejects retailer and marketplace images", () => {
    const amazon = { ...base.images[0], url: "https://m.media-amazon.com/images/I/x.jpg" };
    expect(errors({ ...base, images: [amazon] }).join()).toMatch(/Retailer\/marketplace images are not allowed/);
    expect(isBannedSource("https://rukminim2.flixcart.com/image/x.jpeg")).toBe(true);
    expect(isBannedSource("https://images.samsung.com/is/image/x.png")).toBe(false);
  });

  it("rejects images for colours the product doesn't have", () => {
    expect(errors({ ...base, images: [{ ...base.images[0], color: "Gold" }] }).join()).toMatch(/not a variant colour/);
  });

  it("won't publish without images, specs or legal declarations", () => {
    const e = errors({ ...base, status: "live", images: [], specs: [], manufacturerInfo: null, countryOfOrigin: null }).join("\n");
    expect(e).toMatch(/verified official image/);
    expect(e).toMatch(/specifications/);
    expect(e).toMatch(/Legal Metrology/);
  });

  it("only warns about missing pieces while a product is a draft", () => {
    expect(errors({ ...base, images: [], manufacturerInfo: null })).toEqual([]);
  });

  it("catches duplicate SKUs, duplicate stock-sheet names and leftover TODOs", () => {
    const v = base.variants[0];
    expect(errors({ ...base, variants: [v, { ...v, color: "Black" }] }).join()).toMatch(/Duplicate SKU|listed on two variants/);
    expect(errors({ ...base, description: "TODO write this" }).join()).toMatch(/Unfinished placeholders/);
  });

  it("checks the file name matches the slug and HSN/GST values are valid", () => {
    expect(errors(base, "other-name").join()).toMatch(/slug/);
    expect(errors({ ...base, hsnCode: "85A1" }).join()).toMatch(/HSN/);
    expect(errors({ ...base, gstRatePercent: 15 }).length).toBeGreaterThan(0);
  });
});
