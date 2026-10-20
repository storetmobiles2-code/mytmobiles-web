"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
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
  const admin = await assertAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { grievanceId, status, note } = parsed.data;
  const internal = fd.get("internal") === "on";
  try {
    const r = await updateGrievance(grievanceId, { status: status as (typeof GRIEVANCE_STATUSES)[number], note, internal }, admin.id);
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
