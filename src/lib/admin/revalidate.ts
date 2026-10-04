import "server-only";
import { revalidatePath, updateTag } from "next/cache";

/** After catalogue/settings edits: expire cached nav/settings data and all ISR pages. */
export function revalidateStorefront(tags: ("catalog" | "settings")[] = ["catalog"]) {
  for (const t of tags) updateTag(t);
  revalidatePath("/", "layout");
}
