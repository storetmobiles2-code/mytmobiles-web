import type { GrievanceCategory, GrievanceStatus } from "@/generated/prisma/enums";

/**
 * Consumer Protection (E-Commerce) Rules, 2020:
 * - Rule 4(5): the grievance officer "acknowledges the receipt of any consumer
 *   complaint within forty-eight hours and redresses the complaint within one
 *   month from the date of receipt of the complaint";
 * - Rule 7(1)(f): an inventory e-commerce entity displays "a ticket number for
 *   each complaint lodged, through which the consumer can track the status of
 *   their complaint".
 */
export const ACK_HOURS = 48;
export const RESOLVE_DAYS = 30;

const IST_OFFSET_MS = 5.5 * 3600_000;

export const GRIEVANCE_STATUS_LABEL: Record<GrievanceStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const GRIEVANCE_CATEGORY_LABEL: Record<GrievanceCategory, string> = {
  ORDER: "An order",
  DELIVERY: "Delivery",
  REFUND: "Refund or return",
  PRODUCT: "A product or warranty",
  OTHER: "Something else",
};

export const GRIEVANCE_STATUSES: GrievanceStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
export const GRIEVANCE_CATEGORIES: GrievanceCategory[] = ["ORDER", "DELIVERY", "REFUND", "PRODUCT", "OTHER"];

/** RESOLVED and CLOSED tickets no longer run against the deadlines. */
export const isSettled = (s: GrievanceStatus) => s === "RESOLVED" || s === "CLOSED";

export function grievanceStatusTone(s: GrievanceStatus): "warning" | "info" | "success" | "neutral" {
  return s === "OPEN" ? "warning" : s === "IN_PROGRESS" ? "info" : s === "RESOLVED" ? "success" : "neutral";
}

/** Calendar year in India time; ticket numbers restart at 1 each year. */
export function ticketYear(now = new Date()): number {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCFullYear();
}

/** GRV-2026-000123. Sequences past 999999 keep their extra digits. */
export function formatTicket(year: number, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`Invalid ticket sequence: ${seq}`);
  return `GRV-${year}-${String(seq).padStart(6, "0")}`;
}

export const TICKET_PATTERN = /^GRV-\d{4}-\d{6,}$/;

/** Accepts what people type ("grv 2026 123", " GRV-2026-000123 ") and returns the canonical ticket, or null. */
export function normaliseTicket(input: string): string | null {
  const m = input.trim().toUpperCase().match(/^GRV[\s-]*(\d{4})[\s-]*(\d{1,9})$/);
  if (!m) return null;
  const seq = Number(m[2]);
  return seq >= 1 ? formatTicket(Number(m[1]), seq) : null;
}

/** When the complaint must be acknowledged: 48 hours from receipt. */
export function acknowledgeBy(receivedAt: Date): Date {
  return new Date(receivedAt.getTime() + ACK_HOURS * 3600_000);
}

/**
 * When the complaint must be resolved: one month from receipt. We use the
 * earlier of one calendar month (clamped to the month's last day, so 31 Jan →
 * 28/29 Feb) and 30 days, so the deadline never runs past either reading.
 */
export function resolveBy(receivedAt: Date): Date {
  const d = new Date(receivedAt);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  const thirtyDays = new Date(receivedAt.getTime() + RESOLVE_DAYS * 86_400_000);
  return d < thirtyDays ? d : thirtyDays;
}

export interface GrievanceTimes {
  status: GrievanceStatus;
  createdAt: Date;
  acknowledgedAt: Date | null;
}

export interface GrievanceFlags {
  /** Still not acknowledged and past 48 hours */
  ackOverdue: boolean;
  /** Still unresolved and past the one-month deadline */
  resolveOverdue: boolean;
}

export function grievanceFlags(g: GrievanceTimes, now = new Date()): GrievanceFlags {
  const settled = isSettled(g.status);
  return {
    ackOverdue: !g.acknowledgedAt && !settled && now > acknowledgeBy(g.createdAt),
    resolveOverdue: !settled && now > resolveBy(g.createdAt),
  };
}

export const isOverdue = (g: GrievanceTimes, now = new Date()) => {
  const f = grievanceFlags(g, now);
  return f.ackOverdue || f.resolveOverdue;
};

/** "3 h", "2 days" — how long since the complaint came in. */
export function ageLabel(since: Date, now = new Date()): string {
  const hours = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 3600_000));
  if (hours < 1) return "under 1 h";
  if (hours < 48) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} days`;
}

/** Dates shown to consumers and staff, always in India time. */
export function formatIST(d: Date, withTime = true): string {
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}) });
}
