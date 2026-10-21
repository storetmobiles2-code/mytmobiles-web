import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";

/**
 * Encryption of TOTP secrets at rest and recovery-code hashing. Pure functions;
 * the key comes from the caller (see src/lib/auth/two-factor.ts for env handling).
 */

/** Parses TOTP_ENCRYPTION_KEY: 32 random bytes, base64. Throws with a fix-it message otherwise. */
export function parseEncryptionKey(value: string | undefined): Buffer {
  if (!value?.trim()) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY is not set. Two-factor sign-in needs it to encrypt authenticator secrets. " +
        "Generate one with `openssl rand -base64 32` and add it to the environment (.env locally).",
    );
  }
  const key = Buffer.from(value.trim(), "base64");
  if (key.length !== 32) {
    throw new Error(`TOTP_ENCRYPTION_KEY must be 32 bytes, base64-encoded (got ${key.length} bytes). Generate one with \`openssl rand -base64 32\`.`);
  }
  return key;
}

const VERSION = "v1";

/**
 * AES-256-GCM. The user id is bound in as associated data, so an encrypted
 * secret copied onto another account won't decrypt.
 * Format: v1.<iv>.<tag>.<ciphertext>, each base64url.
 */
export function encryptSecret(plain: string, key: Buffer, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(stored: string, key: Buffer, userId: string): string {
  const [version, iv, tag, ct] = stored.split(".");
  if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error("Unrecognised encrypted secret format.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

// ───────── Recovery codes ─────────

export const RECOVERY_CODE_COUNT = 10;
// No 0/o, 1/i/l, so codes are easy to read back from paper.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** Ten codes like `k7m2-x9qd-4trw` (about 59 bits each). */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    let s = "";
    for (let i = 0; i < 12; i++) s += ALPHABET[randomInt(ALPHABET.length)];
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
  });
}

export function normaliseRecoveryCode(input: string): string {
  return input.toLowerCase().replace(/[\s-]/g, "");
}

/** Recovery codes are random and high-entropy, so a plain SHA-256 is enough. */
export function hashRecoveryCode(input: string): string {
  return createHash("sha256").update(`myt-recovery:${normaliseRecoveryCode(input)}`).digest("hex");
}

/** True if the input looks like a recovery code rather than a 6-digit app code. */
export function looksLikeRecoveryCode(input: string): boolean {
  const n = normaliseRecoveryCode(input);
  return n.length === 12 && [...n].every((c) => ALPHABET.includes(c));
}
