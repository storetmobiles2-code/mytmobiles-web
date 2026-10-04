import "server-only";
import { db } from "./db";
import { canonicalState } from "./indian-states";
import { PINCODE_PATTERN } from "./delivery";

export interface PincodeLookup {
  pincode: string;
  /** false = India Post has no record. null = lookup service unavailable (treat as unknown, not invalid). */
  isValid: boolean | null;
  district: string | null;
  state: string | null;
  postOffice: string | null;
}

const CACHE_DAYS = 30;

/**
 * Resolves a pincode via India Post's public API, cached in Postgres.
 * Degrades gracefully: if the API is down, the pincode is reported as unknown
 * rather than invalid so checkout is never blocked by a third-party outage.
 */
export async function lookupPincode(pincode: string): Promise<PincodeLookup> {
  if (!PINCODE_PATTERN.test(pincode))
    return { pincode, isValid: false, district: null, state: null, postOffice: null };

  const cached = await db.pincodeInfo.findUnique({ where: { pincode } });
  if (cached && cached.fetchedAt > new Date(Date.now() - CACHE_DAYS * 86400_000)) {
    return { pincode, isValid: cached.isValid, district: cached.district, state: cached.state, postOffice: cached.postOffice };
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: AbortSignal.timeout(4000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`India Post API ${res.status}`);
    const body = (await res.json()) as {
      Status: string;
      PostOffice: { Name: string; District: string; State: string; DeliveryStatus?: string }[] | null;
    }[];
    const entry = body[0];
    const offices = entry?.PostOffice ?? [];
    const isValid = entry?.Status === "Success" && offices.length > 0;
    const primary = offices.find((o) => o.DeliveryStatus === "Delivery") ?? offices[0];
    const data = {
      isValid,
      district: primary?.District ?? null,
      state: primary ? (canonicalState(primary.State) ?? primary.State) : null,
      postOffice: primary?.Name ?? null,
    };
    await db.pincodeInfo.upsert({
      where: { pincode },
      update: { ...data, fetchedAt: new Date() },
      create: { pincode, ...data },
    });
    return { pincode, ...data };
  } catch (err) {
    console.warn(`[pincode] lookup failed for ${pincode}:`, (err as Error).message);
    if (cached) return { pincode, isValid: cached.isValid, district: cached.district, state: cached.state, postOffice: cached.postOffice };
    return { pincode, isValid: null, district: null, state: null, postOffice: null };
  }
}
