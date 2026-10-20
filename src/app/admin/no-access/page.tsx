import Link from "next/link";
import { Lock } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { ROLE_LABEL } from "@/lib/auth/permissions";

export const metadata = { title: "No access" };

/** Where requirePermission() sends people whose role doesn't cover a page. */
export default async function NoAccessPage() {
  const user = await requireAdmin();
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-ink-200 bg-white p-8 text-center">
      <Lock className="mx-auto h-8 w-8 text-ink-500" aria-hidden="true" />
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight">You don&apos;t have access to this</h1>
      <p className="mt-2 text-sm text-ink-700">
        Your role is <strong>{ROLE_LABEL[user.role]}</strong>. This page is for the store owner. If you need it for your work, ask the owner to change it for you or to change your role.
      </p>
      <Link href="/admin" className="mt-5 inline-block rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white">Back to dashboard</Link>
    </div>
  );
}
