import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { assessImage, blockingIssues } from "../../scripts/lib/image-quality";

/** A white canvas with one dark rectangle (the "product"). */
function picture(w: number, h: number, box: { x: number; y: number; w: number; h: number }, background = "#ffffff") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${background}"/><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="#333"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe("assessImage", () => {
  it("passes a product cut out on white with a margin", async () => {
    const a = await assessImage(await picture(1200, 1200, { x: 300, y: 100, w: 600, h: 1000 }));
    expect(a.issues).toEqual([]);
    expect(a.productPx).toBe(1000);
  });
  it("passes a product the brand trimmed tight (touching two opposite edges)", async () => {
    const a = await assessImage(await picture(800, 1600, { x: 100, y: 0, w: 600, h: 1600 }));
    expect(a.issues).toEqual([]);
  });
  it("flags a product cut off by one edge", async () => {
    const a = await assessImage(await picture(1600, 1200, { x: 300, y: 400, w: 1000, h: 800 }));
    expect(a.issues).toContain("cropped");
  });
  it("flags a photo with its own background", async () => {
    const a = await assessImage(await picture(1200, 800, { x: 400, y: 200, w: 300, h: 400 }, "#7aa7d8"));
    expect(a.issues).toContain("full-bleed");
  });
  it("flags small sources", async () => {
    expect((await assessImage(await picture(800, 800, { x: 150, y: 100, w: 400, h: 600 }))).issues).toContain("low-res");
    expect((await assessImage(await picture(400, 400, { x: 100, y: 50, w: 150, h: 300 }))).issues).toContain("tiny-source");
  });
});

describe("blockingIssues", () => {
  it("blocks a photo background in a whole-product view but not in a lifestyle shot", async () => {
    const a = await assessImage(await picture(1200, 800, { x: 400, y: 200, w: 300, h: 400 }, "#7aa7d8"));
    expect(blockingIssues(a, "front")).toEqual(["full-bleed"]);
    expect(blockingIssues(a, "lifestyle")).toEqual([]);
  });
  it("leaves crops to the contact-sheet review", async () => {
    const a = await assessImage(await picture(1600, 1200, { x: 300, y: 400, w: 1000, h: 800 }));
    expect(blockingIssues(a, "angle")).toEqual([]);
  });
});
