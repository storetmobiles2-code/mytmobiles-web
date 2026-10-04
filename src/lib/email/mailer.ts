import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, isProduction, smtpConfigured } from "@/lib/env";

let transporter: Transporter | undefined;

function getTransport(): Transporter {
  if (!transporter) {
    const e = env();
    transporter = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT ?? 587,
      secure: (e.SMTP_PORT ?? 587) === 465,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends transactional email. Never throws — a mail outage must not fail an
 * order. Without SMTP configured, mail is printed to the server log in
 * development and reported as an error in production.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!smtpConfigured()) {
    if (isProduction()) {
      console.error(`[mail] SMTP is not configured — "${mail.subject}" to ${mail.to} was NOT sent.`);
    } else {
      console.info(`\n[mail:dev] To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`);
    }
    return false;
  }
  try {
    await getTransport().sendMail({ from: env().EMAIL_FROM, ...mail });
    return true;
  } catch (err) {
    console.error(`[mail] failed to send "${mail.subject}" to ${mail.to}:`, err);
    return false;
  }
}
