import "server-only";
import type { GrievanceCategory, GrievanceStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sendGrievanceAcknowledgement, sendGrievanceUpdate } from "@/lib/email/grievance-emails";
import { ACK_HOURS, formatTicket, GRIEVANCE_STATUS_LABEL, isOverdue, isSettled, ticketYear } from "./rules";

export class GrievanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrievanceError";
  }
}

export interface NewGrievance {
  name: string;
  email: string;
  phone?: string | null;
  orderNumber?: string | null;
  category: GrievanceCategory;
  message: string;
  userId?: string | null;
}

/** Files a complaint with the next ticket number for this year and emails the acknowledgement. */
export async function createGrievance(input: NewGrievance) {
  const year = ticketYear();
  const grievance = await db.$transaction(async (tx) => {
    const counter = await tx.counter.upsert({
      where: { key: `grievance:${year}` },
      update: { value: { increment: 1 } },
      create: { key: `grievance:${year}`, value: 1 },
    });
    const ticket = formatTicket(year, counter.value);
    return tx.grievance.create({
      data: {
        ticket,
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone || null,
        orderNumber: input.orderNumber || null,
        category: input.category,
        message: input.message,
        userId: input.userId ?? null,
        events: { create: { status: "OPEN", message: `Complaint received. Ticket ${ticket}.` } },
      },
    });
  });
  void sendGrievanceAcknowledgement(grievance.id);
  return grievance;
}

/**
 * What a consumer sees when tracking: status, deadlines, resolution and public
 * history. Needs both the ticket and the email it was filed with, and never
 * returns contact details or the original message.
 */
export async function findForTracking(ticket: string, email: string) {
  return db.grievance.findFirst({
    where: { ticket, email: email.toLowerCase() },
    select: {
      ticket: true,
      category: true,
      status: true,
      resolution: true,
      createdAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
      events: { where: { isPublic: true }, orderBy: { createdAt: "asc" }, select: { id: true, status: true, message: true, createdAt: true } },
    },
  });
}

export interface GrievanceUpdate {
  status: GrievanceStatus;
  note?: string;
  /** Internal notes are kept off the consumer's timeline and not emailed. */
  internal?: boolean;
}

/**
 * Staff update: a status change and/or a note. Any change the consumer can see
 * counts as the acknowledgement. Resolving needs a note, which is saved as the
 * resolution and emailed to the consumer.
 */
export async function updateGrievance(id: string, update: GrievanceUpdate, actorId: string) {
  const g = await db.grievance.findUnique({ where: { id } });
  if (!g) throw new GrievanceError("Complaint not found.");
  const note = update.note?.trim() || "";
  const statusChanged = update.status !== g.status;
  if (!statusChanged && !note) throw new GrievanceError("Change the status or write a note.");
  if (update.internal && statusChanged) throw new GrievanceError("Status changes are shown to the customer. Untick “internal note” to change the status.");
  if (update.status === "RESOLVED" && statusChanged && !note) throw new GrievanceError("Write the resolution before marking the complaint resolved.");

  const now = new Date();
  const isPublic = !update.internal;
  const data: Prisma.GrievanceUpdateInput = { status: update.status };
  if (isPublic && !g.acknowledgedAt) data.acknowledgedAt = now;
  if (statusChanged) {
    if (isSettled(update.status) && !g.resolvedAt) data.resolvedAt = now;
    if (!isSettled(update.status)) data.resolvedAt = null;
  }
  if (update.status === "RESOLVED" && note && isPublic) data.resolution = note;

  const message = statusChanged
    ? `Status changed to ${GRIEVANCE_STATUS_LABEL[update.status].toLowerCase()}.${note ? ` ${note}` : ""}`
    : note;
  await db.grievance.update({
    where: { id },
    data: { ...data, events: { create: { status: statusChanged ? update.status : null, message, isPublic, actorId } } },
  });
  if (isPublic) void sendGrievanceUpdate(id, message);
  return { emailed: isPublic };
}

/**
 * Broad database filter for possibly overdue tickets (unsettled and older than
 * 48 hours unacknowledged, or older than 28 days). Narrow the result with isOverdue().
 */
export function overdueCandidatesWhere(now = new Date()): Prisma.GrievanceWhereInput {
  return {
    status: { in: ["OPEN", "IN_PROGRESS"] },
    OR: [{ acknowledgedAt: null, createdAt: { lt: new Date(now.getTime() - ACK_HOURS * 3600_000) } }, { createdAt: { lt: new Date(now.getTime() - 28 * 86_400_000) } }],
  };
}

/** Unsettled tickets and how many of them are past a deadline. For the dashboard and the ops brief. */
export async function grievanceCounts(now = new Date()) {
  const [open, candidates] = await Promise.all([
    db.grievance.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.grievance.findMany({ where: overdueCandidatesWhere(now), select: { status: true, createdAt: true, acknowledgedAt: true } }),
  ]);
  return { open, overdue: candidates.filter((g) => isOverdue(g, now)).length };
}
