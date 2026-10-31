import { describe, expect, it } from "vitest";
import { parseGalleryName, repointStaleImage } from "../../scripts/lib/image-paths";

describe("parseGalleryName", () => {
  it("reads colour and position from fingerprinted and older names", () => {
    expect(parseGalleryName("awesome-icy-blue-3-1a2b3c4d.webp")).toEqual({ colour: "awesome-icy-blue", position: 3 });
    expect(parseGalleryName("black-1.webp")).toEqual({ colour: "black", position: 1 });
  });
  it("ignores files that aren't gallery images", () => {
    expect(parseGalleryName("001.webp")).toBeNull();
    expect(parseGalleryName("photo.png")).toBeNull();
  });
});

describe("repointStaleImage", () => {
  const folder = ["awesome-icy-blue-2-bbbbbbbb.webp", "awesome-icy-blue-1-aaaaaaaa.webp", "awesome-navy-1-cccccccc.webp"];
  it("points a stale copy at the first current image of the same colour", () => {
    expect(repointStaleImage("/images/products/samsung-galaxy-a57/awesome-icy-blue-1.webp", folder)).toBe("/images/products/samsung-galaxy-a57/awesome-icy-blue-1-aaaaaaaa.webp");
    expect(repointStaleImage("/images/products/samsung-galaxy-a57/awesome-icy-blue-4-00000000.webp", folder)).toBe("/images/products/samsung-galaxy-a57/awesome-icy-blue-1-aaaaaaaa.webp");
  });
  it("never substitutes another colour", () => {
    expect(repointStaleImage("/images/products/samsung-galaxy-a57/awesome-lilac-1.webp", folder)).toBeNull();
  });
});

describe("parseGalleryName with an all-digit fingerprint", () => {
  it("doesn't read the fingerprint as the position", () => {
    expect(parseGalleryName("awesome-icy-blue-4-00000000.webp")).toEqual({ colour: "awesome-icy-blue", position: 4 });
  });
});
