import { describe, expect, it } from "vitest";
import { galleryForColor } from "@/lib/catalog/variant-gallery";

describe("galleryForColor", () => {
  const images = [
    { color: "Awesome Gray Green", view: "front-back" as const },
    { color: "Awesome Gray Green", view: "angle" as const },
    { color: "Awesome Lavender", view: "front-back" as const },
  ];

  it("returns only that colour's images when it has some", () => {
    expect(galleryForColor(images, "Awesome Lavender")).toEqual([{ color: "Awesome Lavender", view: "front-back" }]);
  });

  it("regression: a colour with no photos of its own never falls back to a different colour's photos", () => {
    // "Awesome White" has no entry in `images` at all here, mirroring a stock-sheet colour the
    // brand's gallery doesn't cover. Showing Gray Green or Lavender's photos under "White" would
    // misrepresent the product; the gallery must come back empty so the page shows its placeholder.
    expect(galleryForColor(images, "Awesome White")).toEqual([]);
  });

  it("falls back to colourless images (which apply to every colour), never to a mismatched colour", () => {
    const withColourless = [...images, { color: null, view: "detail" as const }];
    expect(galleryForColor(withColourless, "Awesome White")).toEqual([{ color: null, view: "detail" }]);
  });

  it("single-colour products (variant colour null) use the colourless images directly", () => {
    const colourless = [{ color: null, view: "front" as const }, { color: null, view: "back" as const }];
    expect(galleryForColor(colourless, null)).toEqual(colourless);
  });
});
