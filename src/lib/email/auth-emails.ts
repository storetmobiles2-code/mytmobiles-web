import "server-only";
import { siteUrl } from "@/lib/env";
import { sendMail } from "./mailer";
import { button, emailLayout, escapeHtml } from "./layout";

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const url = siteUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  return sendMail({
    to,
    subject: "Reset your myT Mobiles password",
    text: `Hi ${name},\n\nUse this link to reset your password (valid for 1 hour):\n${url}\n\nIf you didn't request this, you can ignore this email.`,
    html: emailLayout({
      storeName: "myT Mobiles",
      preheader: "Reset your password — link valid for 1 hour",
      heading: "Reset your password",
      bodyHtml: `<p>Hi ${escapeHtml(name)},</p><p>We received a request to reset your password. This link is valid for 1 hour.</p>${button(url, "Choose a new password")}<p style="color:#6b6b80;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
    }),
  });
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const url = siteUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  return sendMail({
    to,
    subject: "Verify your email for myT Mobiles",
    text: `Hi ${name},\n\nWelcome to myT Mobiles! Confirm your email address:\n${url}`,
    html: emailLayout({
      storeName: "myT Mobiles",
      preheader: "Confirm your email address",
      heading: `Welcome, ${name.split(" ")[0]}!`,
      bodyHtml: `<p>Thanks for creating a myT Mobiles account. Please confirm your email so we can send order updates.</p>${button(url, "Verify email")}`,
    }),
  });
}
