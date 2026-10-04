"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { clientIp, createSession, destroyAllSessions, destroySession, getCurrentUser } from "@/lib/auth/session";
import { generateToken, sha256 } from "@/lib/auth/tokens";
import { safeNext } from "@/lib/auth/guards";
import { mergeGuestCart } from "@/lib/cart";
import { rateLimit } from "@/lib/rate-limit";
import { emailSchema, fieldErrors, loginSchema, passwordSchema, registerSchema } from "@/lib/validation";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email/auth-emails";
import { trackServer } from "@/lib/analytics";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  values?: Record<string, string>;
}

const RESET_TTL_MS = 60 * 60 * 1000;
const VERIFY_TTL_MS = 3 * 24 * 60 * 60 * 1000;

async function issueToken(userId: string, type: "PASSWORD_RESET" | "EMAIL_VERIFICATION", ttl: number): Promise<string> {
  const token = generateToken();
  await db.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  await db.authToken.create({ data: { id: sha256(token), userId, type, expiresAt: new Date(Date.now() + ttl) } });
  return token;
}

export async function register(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), phone: String(fd.get("phone") ?? "") };
  if (!(await rateLimit(`register:${await clientIp()}`, 5, 3600))) return { error: "Too many sign-up attempts. Please try again later.", values };
  const parsed = registerSchema.safeParse({ ...values, password: fd.get("password"), marketingOptIn: fd.get("marketingOptIn") === "on" });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  if (fd.get("terms") !== "on") return { fieldErrors: { terms: "Please accept the terms to continue." }, values };

  const { name, email, phone, password, marketingOptIn } = parsed.data;
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { fieldErrors: { email: "An account with this email already exists. Sign in instead." }, values };
  }
  const user = await db.user.create({
    data: { name, email, phone: phone || null, passwordHash: await hashPassword(password), marketingOptIn: Boolean(marketingOptIn) },
  });
  await mergeGuestCart(user.id);
  await createSession(user.id);
  const token = await issueToken(user.id, "EMAIL_VERIFICATION", VERIFY_TTL_MS);
  void sendVerificationEmail(user.email, user.name, token);
  void trackServer({ name: "sign_up", userId: user.id });
  redirect(safeNext(fd.get("next"), "/account"));
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { email: String(fd.get("email") ?? "") };
  const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const ip = await clientIp();
  const [ipOk, acctOk] = await Promise.all([rateLimit(`login-ip:${ip}`, 20, 900), rateLimit(`login-acct:${parsed.data.email}`, 8, 900)]);
  if (!ipOk || !acctOk) return { error: "Too many sign-in attempts. Please wait 15 minutes or reset your password.", values };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  // Always run a hash comparison so response time doesn't reveal whether the email exists.
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) return { error: "Incorrect email or password.", values };
  if (user.isDisabled) return { error: "This account has been disabled. Please contact support.", values };

  await mergeGuestCart(user.id);
  await createSession(user.id);
  void trackServer({ name: "login", userId: user.id });
  redirect(safeNext(fd.get("next"), user.role === "ADMIN" ? "/admin" : "/account"));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function requestPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(fd.get("email"));
  if (!email.success) return { fieldErrors: { email: email.error.issues[0].message } };
  if (!(await rateLimit(`reset:${await clientIp()}`, 5, 3600)) || !(await rateLimit(`reset-acct:${email.data}`, 3, 3600))) {
    return { error: "Too many requests. Please try again in an hour." };
  }
  const user = await db.user.findUnique({ where: { email: email.data } });
  if (user && !user.isDisabled) {
    const token = await issueToken(user.id, "PASSWORD_RESET", RESET_TTL_MS);
    await sendPasswordResetEmail(user.email, user.name, token);
  }
  // Same response either way — don't reveal which emails are registered.
  return { success: "If an account exists for that email, we've sent a link to reset your password. It's valid for 1 hour." };
}

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get("token") ?? "");
  const password = passwordSchema.safeParse(fd.get("password"));
  if (!password.success) return { fieldErrors: { password: password.error.issues[0].message } };
  if (fd.get("password") !== fd.get("confirm")) return { fieldErrors: { confirm: "Passwords don't match." } };
  if (!(await rateLimit(`reset-submit:${await clientIp()}`, 10, 3600))) return { error: "Too many attempts. Please try again later." };

  const record = await db.authToken.findUnique({ where: { id: sha256(token) } });
  if (!record || record.type !== "PASSWORD_RESET" || record.usedAt || record.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password.data), emailVerifiedAt: new Date() } }),
    db.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  await destroyAllSessions(record.userId); // sign out everywhere
  await createSession(record.userId);
  redirect("/account?reset=1");
}

export async function verifyEmail(token: string): Promise<boolean> {
  const record = await db.authToken.findUnique({ where: { id: sha256(token) } });
  if (!record || record.type !== "EMAIL_VERIFICATION" || record.usedAt || record.expiresAt < new Date()) return false;
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    db.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return true;
}

export async function resendVerification(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  if (user.emailVerified) return { success: "Your email is already verified." };
  if (!(await rateLimit(`verify-resend:${user.id}`, 3, 3600))) return { error: "Please wait before requesting another email." };
  const token = await issueToken(user.id, "EMAIL_VERIFICATION", VERIFY_TTL_MS);
  await sendVerificationEmail(user.email, user.name, token);
  return { success: `We've sent a verification link to ${user.email}.` };
}
