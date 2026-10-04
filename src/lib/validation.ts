import { z } from "zod";
import { STATE_NAMES } from "./indian-states";
import { isValidGstin } from "./gst";

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const emailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254));

/** Indian mobile number; accepts +91 / 0 prefixes and spaces, normalises to 10 digits. */
export const mobileSchema = z
  .string({ error: "Mobile number is required" })
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));

export const pincodeSchema = z
  .string({ error: "Pincode is required" })
  .trim()
  .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode");

export const passwordSchema = z
  .string({ error: "Password is required" })
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use at least one letter and one number");

export const registerSchema = z.object({
  name: trimmed(2, 80, "Name"),
  email: emailSchema,
  phone: z.union([z.literal(""), mobileSchema]).optional(),
  password: passwordSchema,
  marketingOptIn: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const addressSchema = z.object({
  fullName: trimmed(2, 80, "Full name"),
  phone: mobileSchema,
  line1: trimmed(5, 120, "Flat / house no., building"),
  line2: z.string().trim().max(120).optional().default(""),
  landmark: z.string().trim().max(80).optional().default(""),
  city: trimmed(2, 60, "City"),
  state: z.enum(STATE_NAMES as unknown as [string, ...string[]], { error: "Select a state" }),
  pincode: pincodeSchema,
  type: z.enum(["HOME", "WORK", "OTHER"]).default("HOME"),
  isDefault: z.boolean().optional().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => v === "" || isValidGstin(v), "Enter a valid 15-character GSTIN");

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  title: trimmed(3, 100, "Title"),
  body: trimmed(10, 2000, "Review"),
});

export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,24}$/, "Enter a valid coupon code");

/** Flattens a ZodError into { field: firstMessage } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

export function formDataToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
