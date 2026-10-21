"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/guards";
import { audit } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { smtpConfigured } from "@/lib/env";
import { GrievanceError, updateGrievance } from "@/lib/grievances/service";
import { GRIEVANCE_STATUSES } from "@/lib/grievances/rules";

type Result = { ok?: string; error?: string };

const updateSchema = z.object({
  grievanceId: z.string().cuid(),
  status: z.enum(GRIEVANCE_STATUSES as [string, ...string[]]),
  note: z.string().trim().max(3000, "Keep the note under 3,000 characters").optional(),
});

export async function updateGrievanceAction(_prev: Result, fd: FormData): Promise<Result> {
  const admin = await assertPermission("grievances.manage");
  const parsed = updateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { grievanceId, status, note } = parsed.data;
  const internal = fd.get("internal") === "on";
  try {
    const before = await db.grievance.findUnique({ where: { id: grievanceId }, select: { ticket: true, status: true } });
    const r = await updateGrievance(grievanceId, { status: status as (typeof GRIEVANCE_STATUSES)[number], note, internal }, admin.id);
    await audit({
      actor: admin,
      action: before && before.status !== status ? "grievance.status_changed" : "grievance.note_added",
      entityType: "grievance",
      entityId: grievanceId,
      summary: `Complaint ${before?.ticket ?? grievanceId}: ${before && before.status !== status ? `${before.status} → ${status}` : "note added"}${internal ? " (internal)" : ""}`,
      changes: before && before.status !== status ? { status: { before: before.status, after: status } } : null,
    });
    revalidatePath(`/admin/grievances/${grievanceId}`);
    revalidatePath("/admin/grievances");
    if (!r.emailed) return { ok: "Internal note saved." };
    return { ok: smtpConfigured() ? "Saved and emailed to the customer." : "Saved. The customer sees it when tracking the complaint (SMTP is not set up, so no email was sent)." };
  } catch (err) {
    if (err instanceof GrievanceError) return { error: err.message };
    console.error("[grievance] update failed", err);
    return { error: "Couldn't update the complaint." };
  }
}
