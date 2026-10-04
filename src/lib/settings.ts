import "server-only";
import { cache } from "react";
import { db } from "./db";
import type { StoreSettings } from "@/generated/prisma/client";

export const getSettings = cache(async (): Promise<StoreSettings> => {
  return db.storeSettings.upsert({ where: { id: "store" }, update: {}, create: { id: "store" } });
});

/** Things an admin must configure before going live. Shown on the admin dashboard. */
export function setupGaps(s: StoreSettings): string[] {
  const gaps: string[] = [];
  if (!s.legalName) gaps.push("Registered legal business name (Settings → Business)");
  if (!s.gstin) gaps.push("GSTIN — required on tax invoices (Settings → Business)");
  if (!s.state || !s.pincode) gaps.push("Dispatch address state & pincode — needed for GST and delivery estimates");
  if (!s.supportEmail || !s.supportPhone) gaps.push("Customer support email & phone");
  return gaps;
}
