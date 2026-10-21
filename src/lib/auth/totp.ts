import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238, built on HOTP from RFC 4226).
 * Defaults match Google Authenticator, Microsoft Authenticator and similar
 * apps: SHA-1, 6 digits, 30-second steps.
 *
 * Pure functions with no database or environment access, so they can be used
 * by the app, scripts and the e2e helpers alike.
 */

export const TOTP_PERIOD = 30;
export const TOTP_DIGITS = 6;
/** Accept the previous and next step too, for clock drift and slow typing. */
export const TOTP_WINDOW = 1;

export type TotpAlgorithm = "sha1" | "sha256" | "sha512";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/** Decodes RFC 4648 base32. Ignores case, spaces, dashes and padding, as apps do. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 character.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret (the size RFC 4226 recommends for SHA-1), base32-encoded. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS, algorithm: TotpAlgorithm = "sha1"): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algorithm, secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return binary.toString().padStart(digits, "0");
}

/** The time step a moment falls in (seconds since the epoch / 30). */
export function totpStep(nowMs = Date.now(), period = TOTP_PERIOD): number {
  return Math.floor(nowMs / 1000 / period);
}

export function totpCode(secretBase32: string, step: number, digits = TOTP_DIGITS, algorithm: TotpAlgorithm = "sha1"): string {
  return hotp(base32Decode(secretBase32), step, digits, algorithm);
}

/**
 * Checks a code against the current step ±TOTP_WINDOW. Returns the matched
 * step, or null. Steps at or before `lastStep` are refused, so a code can be
 * used only once; store the returned step as the new lastStep.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  { nowMs = Date.now(), lastStep = null, window = TOTP_WINDOW }: { nowMs?: number; lastStep?: number | null; window?: number } = {},
): number | null {
  const given = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(given)) return null;
  const secret = base32Decode(secretBase32);
  const now = totpStep(nowMs);
  let matched: number | null = null;
  // Check every candidate (no early exit) so timing doesn't reveal which one matched.
  for (let step = now - window; step <= now + window; step++) {
    const ok = timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(given));
    if (ok && matched === null && (lastStep === null || step > lastStep)) matched = step;
  }
  return matched;
}

/** The otpauth:// URI that authenticator apps read from the QR code. */
export function otpauthUri({ secret, account, issuer }: { secret: string; account: string; issuer: string }): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Groups a base32 secret in fours for typing it into an app by hand. */
export function formatManualKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
