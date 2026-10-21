"use server";

import { z } from "zod";
import type { GrievanceStatus } from "@/generated/prisma/enums";
import { clientIp, getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { smtpConfigured } from "@/lib/env";
import { emailSchema, fieldErrors, mobileSchema } from "@/lib/validation";
import { createGrievance, findForTracking } from "@/lib/grievances/service";
import { acknowledgeBy, formatIST, GRIEVANCE_CATEGORIES, GRIEVANCE_CATEGORY_LABEL, GRIEVANCE_STATUS_LABEL, normaliseTicket, resolveBy } from "@/lib/grievances/rules";

export interface FileGrievanceState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  filed?: { ticket: string; email: string; acknowledgeBy: string; resolveBy: string; emailed: boolean };
}

export interface TrackGrievanceState {
  error?: string;
  values?: { ticket: string; email: string };
  result?: {
    ticket: string;
    category: string;
    status: string;
    statusKey: GrievanceStatus;
    receivedAt: string;
    acknowledgeBy: string;
    acknowledgedAt: string | null;
    resolveBy: string;
    resolvedAt: string | null;
    resolution: string | null;
    events: { id: string; message: string; at: string }[];
  };
}

const grievanceSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80, "Name must be at most 80 characters"),
  email: emailSchema,
  phone: z.union([z.literal(""), mobileSchema]).optional(),
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z0-9][A-Z0-9-]{3,29})?$/, "Enter the order number as shown on your order, e.g. MYT-261004-7KQ2XD")
    .optional(),
  category: z.enum(GRIEVANCE_CATEGORIES as [string, ...string[]], { error: "Choose what your complaint is about" }),
  message: z.string().trim().min(20, "Describe the problem in at least 20 characters").max(3000, "Keep it under 3,000 characters"),
});

export async function fileGrievance(_prev: FileGrievanceState, fd: FormData): Promise<FileGrievanceState> {
  const values = Object.fromEntries(["name", "email", "phone", "orderNumber", "category", "message"].map((k) => [k, String(fd.get(k) ?? "")]));
  const parsed = grievanceSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const ip = await clientIp();
  const [ipOk, emailOk] = await Promise.all([rateLimit(`grievance:${ip}`, 5, 3600), rateLimit(`grievance-email:${parsed.data.email}`, 5, 86_400)]);
  if (!ipOk || !emailOk) return { error: "Too many complaints from you in a short time. Please try again later, or call or email our grievance officer.", values };

  const user = await getCurrentUser();
  const d = parsed.data;
  try {
    const g = await createGrievance({
      name: d.name,
      email: d.email,
      phone: d.phone || null,
      orderNumber: d.orderNumber || null,
      category: d.category as (typeof GRIEVANCE_CATEGORIES)[number],
      message: d.message,
      userId: user?.id ?? null,
    });
    return {
      filed: {
        ticket: g.ticket,
        email: g.email,
        acknowledgeBy: formatIST(acknowledgeBy(g.createdAt)),
        resolveBy: formatIST(resolveBy(g.createdAt), false),
        emailed: smtpConfigured(),
      },
    };
  } catch (err) {
    console.error("[grievance] could not file complaint", err);
    return { error: "We couldn't save your complaint. Please try again, or call or email our grievance officer.", values };
  }
}

export async function trackGrievance(_prev: TrackGrievanceState, fd: FormData): Promise<TrackGrievanceState> {
  const values = { ticket: String(fd.get("ticket") ?? "").trim(), email: String(fd.get("email") ?? "").trim() };
  const ticket = normaliseTicket(values.ticket);
  const email = emailSchema.safeParse(values.email);
  if (!ticket) return { error: "Enter your ticket number, e.g. GRV-2026-000123.", values };
  if (!email.success) return { error: "Enter the email address you used when filing the complaint.", values };
  if (!(await rateLimit(`grievance-track:${await clientIp()}`, 20, 900))) return { error: "Too many lookups. Please wait 15 minutes and try again.", values };

  const g = await findForTracking(ticket, email.data);
  // Same message whether the ticket or the email is wrong.
  if (!g) return { error: "We couldn't find a complaint with that ticket number and email. Check both and try again.", values };
  return {
    values: { ticket: g.ticket, email: email.data },
    result: {
      ticket: g.ticket,
      category: GRIEVANCE_CATEGORY_LABEL[g.category],
      status: GRIEVANCE_STATUS_LABEL[g.status],
      statusKey: g.status,
      receivedAt: formatIST(g.createdAt),
      acknowledgeBy: formatIST(acknowledgeBy(g.createdAt)),
      acknowledgedAt: g.acknowledgedAt ? formatIST(g.acknowledgedAt) : null,
      resolveBy: formatIST(resolveBy(g.createdAt), false),
      resolvedAt: g.resolvedAt ? formatIST(g.resolvedAt) : null,
      resolution: g.resolution,
      events: g.events.map((e) => ({ id: e.id, message: e.message, at: formatIST(e.createdAt) })),
    },
  };
}
