import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateTotpSecret, totpCode, totpStep } from "@/lib/auth/totp";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  normaliseRecoveryCode,
  parseEncryptionKey,
} from "@/lib/auth/two-factor-crypto";

const KEY_B64 = randomBytes(32).toString("base64");

describe("secret encryption (AES-256-GCM)", () => {
  const key = parseEncryptionKey(KEY_B64);

  it("round-trips", () => {
    const secret = generateTotpSecret();
    const enc = encryptSecret(secret, key, "user_1");
    expect(enc).not.toContain(secret);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptSecret(enc, key, "user_1")).toBe(secret);
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("SAME", key, "u")).not.toBe(encryptSecret("SAME", key, "u"));
  });

  it("fails with the wrong key, the wrong user or tampered data", () => {
    const enc = encryptSecret("JBSWY3DPEHPK3PXP", key, "user_1");
    expect(() => decryptSecret(enc, parseEncryptionKey(randomBytes(32).toString("base64")), "user_1")).toThrow();
    expect(() => decryptSecret(enc, key, "user_2")).toThrow();
    const parts = enc.split(".");
    const ct = Buffer.from(parts[3], "base64url");
    ct[0] ^= 1;
    expect(() => decryptSecret([...parts.slice(0, 3), ct.toString("base64url")].join("."), key, "user_1")).toThrow();
    expect(() => decryptSecret("garbage", key, "user_1")).toThrow();
  });

  it("refuses a missing or short key with a clear message", () => {
    expect(() => parseEncryptionKey(undefined)).toThrow(/TOTP_ENCRYPTION_KEY is not set.*openssl rand -base64 32/);
    expect(() => parseEncryptionKey("")).toThrow(/not set/);
    expect(() => parseEncryptionKey(randomBytes(16).toString("base64"))).toThrow(/must be 32 bytes/);
  });
});

describe("recovery codes", () => {
  it("generates 10 distinct, readable codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) {
      expect(c).toMatch(/^[2-9a-hjkmnp-z]{4}-[2-9a-hjkmnp-z]{4}-[2-9a-hjkmnp-z]{4}$/);
      expect(looksLikeRecoveryCode(c)).toBe(true);
    }
  });

  it("hashes the normalised code, so case, spaces and dashes don't matter", () => {
    const [code] = generateRecoveryCodes(1);
    const h = hashRecoveryCode(code);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(normaliseRecoveryCode(code));
    expect(hashRecoveryCode(code.toUpperCase().replace(/-/g, " "))).toBe(h);
    expect(hashRecoveryCode(generateRecoveryCodes(1)[0])).not.toBe(h);
  });

  it("tells recovery codes from app codes", () => {
    expect(looksLikeRecoveryCode("123456")).toBe(false);
    expect(looksLikeRecoveryCode("abcd-efgh-jkmn")).toBe(true);
    expect(looksLikeRecoveryCode("abcd-efgh-jkm0")).toBe(false);
  });
});

// ───────── checkSecondFactor against an in-memory database ─────────

const store = vi.hoisted(() => ({
  user: null as null | { id: string; totpSecretEnc: string | null; totpEnabledAt: Date | null; totpLastStep: number | null },
  codes: [] as { userId: string; codeHash: string; usedAt: Date | null }[],
  failures: 0,
}));

vi.mock("@/lib/env", () => ({ env: () => ({ TOTP_ENCRYPTION_KEY: KEY_B64, NODE_ENV: "test" }) }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => {
  type Where = { id?: string; userId?: string; codeHash?: string; usedAt?: null; OR?: { totpLastStep: null | { lt: number } }[] };
  const db = {
    user: {
      findUnique: async () => store.user,
      updateMany: async ({ where, data }: { where: Where; data: { totpLastStep: number } }) => {
        const u = store.user;
        if (!u || u.id !== where.id) return { count: 0 };
        const fresh = u.totpLastStep === null || u.totpLastStep < data.totpLastStep;
        if (!fresh) return { count: 0 };
        u.totpLastStep = data.totpLastStep;
        return { count: 1 };
      },
    },
    recoveryCode: {
      updateMany: async ({ where }: { where: Where }) => {
        const row = store.codes.find((c) => c.userId === where.userId && c.codeHash === where.codeHash && c.usedAt === null);
        if (!row) return { count: 0 };
        row.usedAt = new Date();
        return { count: 1 };
      },
    },
    rateLimit: { deleteMany: async () => ((store.failures = 0), { count: 1 }) },
    // Lockout queries: SELECT → locked?, INSERT → count a failure.
    $queryRaw: async (sql: TemplateStringsArray) => {
      if (sql.join("").includes("SELECT")) return [{ locked: store.failures >= 5 }];
      store.failures += 1;
      return [{ count: store.failures }];
    },
  };
  return { db };
});

const { checkSecondFactor } = await import("@/lib/auth/two-factor");

describe("checkSecondFactor", () => {
  const secret = generateTotpSecret();
  const codes = generateRecoveryCodes();

  beforeEach(() => {
    store.user = { id: "u1", totpSecretEnc: encryptSecret(secret, parseEncryptionKey(KEY_B64), "u1"), totpEnabledAt: new Date(), totpLastStep: null };
    store.codes = codes.map((c) => ({ userId: "u1", codeHash: hashRecoveryCode(c), usedAt: null }));
    store.failures = 0;
  });

  it("accepts the current app code once, then refuses it (replay)", async () => {
    const step = totpStep();
    const code = totpCode(secret, step);
    expect(await checkSecondFactor("u1", code)).toBe("ok");
    expect(store.user!.totpLastStep).toBe(step);
    expect(await checkSecondFactor("u1", code)).toBe("invalid");
  });

  it("accepts a recovery code only once", async () => {
    expect(await checkSecondFactor("u1", codes[3].toUpperCase())).toBe("ok");
    expect(await checkSecondFactor("u1", codes[3])).toBe("invalid");
    expect(await checkSecondFactor("u1", codes[4])).toBe("ok");
  });

  it("can refuse recovery codes where only an app code is allowed", async () => {
    expect(await checkSecondFactor("u1", codes[0], { allowRecovery: false })).toBe("invalid");
  });

  it("locks after 5 wrong codes, even for a right one", async () => {
    for (let i = 0; i < 4; i++) expect(await checkSecondFactor("u1", "zzzz-zzzz-zzzz")).toBe("invalid");
    expect(await checkSecondFactor("u1", "zzzz-zzzz-zzzz")).toBe("locked");
    expect(await checkSecondFactor("u1", totpCode(secret, totpStep()))).toBe("locked");
  });

  it("clears the failure count after a right code", async () => {
    expect(await checkSecondFactor("u1", "zzzz-zzzz-zzzz")).toBe("invalid");
    expect(store.failures).toBe(1);
    expect(await checkSecondFactor("u1", codes[0])).toBe("ok");
    expect(store.failures).toBe(0);
  });

  it("refuses everything when 2FA is not on", async () => {
    store.user = { ...store.user!, totpEnabledAt: null };
    expect(await checkSecondFactor("u1", totpCode(secret, totpStep()))).toBe("invalid");
  });
});
