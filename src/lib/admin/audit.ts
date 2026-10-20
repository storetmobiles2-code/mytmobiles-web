import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { cleanChanges, type AuditChanges } from "./audit-diff";

/** A signed-in admin/staff user, or a named system actor such as the catalogue CLI. */
export type AuditActor = { id: string; email: string } | { id?: null; email: string } | null;

export const SYSTEM_ACTOR = { email: "system" } as const;
export const CATALOG_CLI_ACTOR = { email: "catalog-apply (CLI)" } as const;

export interface AuditEntry {
  actor: AuditActor;
  /** e.g. order.status_changed, product.price_changed, settings.updated */
  action: string;
  /** e.g. order, product, coupon, settings, user */
  entityType: string;
  entityId?: string | null;
  /** One human-readable line */
  summary: string;
  /** Before/after for the changed fields only (see diffChanges). Secrets are dropped. */
  changes?: AuditChanges | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** The request's IP and browser, when there is a request (not in the CLI). */
async function requestInfo(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
      userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * Records who changed what. Never throws into the caller: the change has
 * already happened, so a logging failure is reported and the request goes on.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const req = entry.ip !== undefined || entry.userAgent !== undefined ? { ip: entry.ip ?? null, userAgent: entry.userAgent ?? null } : await requestInfo();
    const changes = cleanChanges(entry.changes);
    await db.auditLog.create({
      data: {
        actorId: entry.actor?.id ?? null,
        actorEmail: (entry.actor?.email ?? SYSTEM_ACTOR.email).slice(0, 190),
        action: entry.action.slice(0, 64),
        entityType: entry.entityType.slice(0, 40),
        entityId: entry.entityId ?? null,
        summary: entry.summary.slice(0, 500),
        changes: changes ? (changes as Prisma.InputJsonValue) : undefined,
        ip: req.ip,
        userAgent: req.userAgent,
      },
    });
  } catch (err) {
    console.error(`[audit] could not record ${entry.action} on ${entry.entityType} ${entry.entityId ?? ""}`, err);
  }
}
