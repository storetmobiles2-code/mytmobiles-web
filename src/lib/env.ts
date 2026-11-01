import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at first use. Optional integrations
 * (Razorpay, SMTP, analytics) are feature-flagged on the presence of their keys —
 * the UI never offers a feature whose credentials are missing.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  CRON_SECRET: z.string().min(16).optional(),
  // Bearer secret for POST /api/sync/pos-stock (myBillBook stock sync).
  POS_SYNC_SECRET: z.string().min(32).optional(),
  // Bearer secret for the approval bot: list and decide held POS prices (/api/sync/held-prices).
  HARNESS_SECRET: z.string().min(32).optional(),

  // Admin two-factor sign-in (src/lib/auth/two-factor.ts). The key is checked
  // when 2FA is used, with a message saying how to create one.
  TOTP_ENCRYPTION_KEY: z.string().optional(),
  ADMIN_2FA_ENFORCED: z.string().optional(),
});

type Env = z.infer<typeof schema>;
let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Invalid environment configuration:\n${parsed.error.issues
          .map((i) => `  ${i.path.join(".")}: ${i.message}`)
          .join("\n")}`,
      );
    }
    cached = parsed.data;
  }
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

export function razorpayConfigured(): boolean {
  const e = env();
  return Boolean(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET);
}

export function smtpConfigured(): boolean {
  const e = env();
  return Boolean(e.SMTP_HOST && e.EMAIL_FROM);
}

export function siteUrl(path = ""): string {
  return new URL(path, env().NEXT_PUBLIC_SITE_URL).toString();
}
