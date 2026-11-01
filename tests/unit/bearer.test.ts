import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { bearerMatches } from "@/lib/sync/bearer";

const req = (auth?: string) => new Request("http://x", { headers: auth ? { authorization: auth } : {} }) as unknown as NextRequest;
const CRON = "c".repeat(24);
const EXPIRE = "e".repeat(32);
// Mirrors the check in /api/cron/expire-orders.
const allowed = (r: NextRequest, cron?: string, expire?: string) => bearerMatches(r, cron) || bearerMatches(r, expire);

describe("bearerMatches", () => {
  it("accepts the right secret and rejects wrong, short and missing ones", () => {
    expect(bearerMatches(req(`Bearer ${CRON}`), CRON)).toBe(true);
    expect(bearerMatches(req(`Bearer ${EXPIRE}`), CRON)).toBe(false);
    expect(bearerMatches(req("Bearer short"), CRON)).toBe(false);
    expect(bearerMatches(req(), CRON)).toBe(false);
  });
  it("never matches an unset or empty secret", () => {
    expect(bearerMatches(req("Bearer "), undefined)).toBe(false);
    expect(bearerMatches(req("Bearer "), "")).toBe(false);
    expect(bearerMatches(req(), undefined)).toBe(false);
  });
  it("expire-orders accepts either secret, and an unset one never opens the door", () => {
    expect(allowed(req(`Bearer ${CRON}`), CRON, EXPIRE)).toBe(true);
    expect(allowed(req(`Bearer ${EXPIRE}`), CRON, EXPIRE)).toBe(true);
    expect(allowed(req(`Bearer ${EXPIRE}`), CRON, undefined)).toBe(false);
    expect(allowed(req("Bearer "), undefined, undefined)).toBe(false);
  });
});
