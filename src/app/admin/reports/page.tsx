import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { AdminPage } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = { title: "Reports" };

const REPORTS = [
  {
    href: "/admin/reports/gst",
    title: "GST (GSTR-1)",
    body: "Monthly invoice register, B2B, B2CL, B2CS, HSN summary and documents issued, with a sales summary. Download as CSV files for the accountant.",
  },
];

export default async function ReportsPage() {
  await requirePermission("reports.view");
  return (
    <AdminPage title="Reports" description="Read-only reports for the accountant and the owner.">
      <ul className="grid gap-3 md:grid-cols-2">
        {REPORTS.map((r) => (
          <li key={r.href}>
            <Link href={r.href} className="flex h-full gap-3 rounded-2xl border border-ink-200 bg-white p-5 transition hover:border-ink-300">
              <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
              <span>
                <span className="block font-bold">{r.title}</span>
                <span className="mt-1 block text-sm text-ink-500">{r.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminPage>
  );
}
