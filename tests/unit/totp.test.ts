import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, formatManualKey, generateTotpSecret, otpauthUri, totpCode, totpStep, verifyTotp, type TotpAlgorithm } from "@/lib/auth/totp";

const b32 = (ascii: string) => base32Encode(Buffer.from(ascii, "ascii"));

// RFC 6238 Appendix B: 8-digit codes, 30-second steps, ASCII seeds per algorithm.
const SEEDS: Record<TotpAlgorithm, string> = {
  sha1: "12345678901234567890",
  sha256: "12345678901234567890123456789012",
  sha512: "1234567890123456789012345678901234567890123456789012345678901234",
};
const VECTORS: [number, Record<TotpAlgorithm, string>][] = [
  [59, { sha1: "94287082", sha256: "46119246", sha512: "90693936" }],
  [1111111109, { sha1: "07081804", sha256: "68084774", sha512: "25091201" }],
  [1111111111, { sha1: "14050471", sha256: "67062674", sha512: "99943326" }],
  [1234567890, { sha1: "89005924", sha256: "91819424", sha512: "93441116" }],
  [2000000000, { sha1: "69279037", sha256: "90698825", sha512: "38618901" }],
  [20000000000, { sha1: "65353130", sha256: "77737706", sha512: "47863826" }],
];

describe("TOTP (RFC 6238)", () => {
  for (const [t, codes] of VECTORS) {
    for (const algo of ["sha1", "sha256", "sha512"] as const) {
      it(`${algo} at T=${t}`, () => {
        expect(totpCode(b32(SEEDS[algo]), totpStep(t * 1000), 8, algo)).toBe(codes[algo]);
      });
    }
  }

  it("6-digit codes are the last 6 digits of the RFC values", () => {
    expect(totpCode(b32(SEEDS.sha1), totpStep(59_000))).toBe("287082");
    expect(totpCode(b32(SEEDS.sha1), totpStep(1111111109_000))).toBe("081804");
  });
});

describe("base32", () => {
  it("round-trips and matches RFC 4648", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("MZXW6YTBOI").toString()).toBe("foobar");
    expect(base32Decode("mzxw 6ytb-oi==").toString()).toBe("foobar");
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
  });

  it("rejects invalid characters", () => {
    expect(() => base32Decode("ABC1")).toThrow();
  });
});

describe("verifyTotp", () => {
  const secret = b32(SEEDS.sha1);
  const now = 1_700_000_000_000;
  const step = totpStep(now);
  const at = (s: number) => totpCode(secret, s);

  it("accepts the current step and one step either side", () => {
    expect(verifyTotp(secret, at(step), { nowMs: now })).toBe(step);
    expect(verifyTotp(secret, at(step - 1), { nowMs: now })).toBe(step - 1);
    expect(verifyTotp(secret, at(step + 1), { nowMs: now })).toBe(step + 1);
  });

  it("rejects codes outside the window", () => {
    expect(verifyTotp(secret, at(step - 2), { nowMs: now })).toBeNull();
    expect(verifyTotp(secret, at(step + 2), { nowMs: now })).toBeNull();
  });

  it("refuses a code from a step already used (replay)", () => {
    expect(verifyTotp(secret, at(step), { nowMs: now, lastStep: step })).toBeNull();
    expect(verifyTotp(secret, at(step - 1), { nowMs: now, lastStep: step - 1 })).toBeNull();
    // A newer step is still fine.
    expect(verifyTotp(secret, at(step + 1), { nowMs: now, lastStep: step })).toBe(step + 1);
  });

  it("ignores a space in the middle and rejects malformed input", () => {
    const c = at(step);
    expect(verifyTotp(secret, `${c.slice(0, 3)} ${c.slice(3)}`, { nowMs: now })).toBe(step);
    expect(verifyTotp(secret, "", { nowMs: now })).toBeNull();
    expect(verifyTotp(secret, "12345", { nowMs: now })).toBeNull();
    expect(verifyTotp(secret, "abcdef", { nowMs: now })).toBeNull();
  });

  it("rejects a code made with another secret", () => {
    expect(verifyTotp(generateTotpSecret(), at(step), { nowMs: now })).toBeNull();
  });
});

describe("otpauth URI", () => {
  it("has the parameters authenticator apps expect", () => {
    const uri = otpauthUri({ secret: "JBSWY3DPEHPK3PXP", account: "owner@example.com", issuer: "myT Mobiles" });
    expect(uri.startsWith("otpauth://totp/myT%20Mobiles:owner%40example.com?")).toBe(true);
    const params = new URL(uri).searchParams;
    expect(params.get("secret")).toBe("JBSWY3DPEHPK3PXP");
    expect(params.get("issuer")).toBe("myT Mobiles");
    expect(params.get("algorithm")).toBe("SHA1");
    expect(params.get("digits")).toBe("6");
    expect(params.get("period")).toBe("30");
  });

  it("formats the manual key in groups of four", () => {
    expect(formatManualKey("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });
});
