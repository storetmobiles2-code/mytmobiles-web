import Link from "next/link";
import { db } from "@/lib/db";
import { setReviewStatus } from "@/app/admin/actions/store";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const reviews = await db.review.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { product: { select: { name: true, slug: true } }, user: { select: { name: true, email: true } } } });
  return (
    <AdminPage title="Reviews" description="Only customers with a delivered order can review. Hide reviews that are abusive or off-topic — not ones that are merely negative.">
      <Panel>
        <ul className="divide-y divide-ink-100">
          {reviews.map((r) => (
            <li key={r.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p><strong>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</strong> {r.title} · <Link href={`/p/${r.product.slug}`} className="text-brand-700">{r.product.name}</Link></p>
                <span className="flex items-center gap-3">
                  <Badge tone={r.status === "PUBLISHED" ? "success" : "neutral"}>{r.status}</Badge>
                  <ActionButton run={setReviewStatus.bind(null, r.id, r.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED")}>{r.status === "PUBLISHED" ? "Hide" : "Publish"}</ActionButton>
                </span>
              </div>
              <p className="mt-1 text-ink-700">{r.body}</p>
              <p className="mt-1 text-xs text-ink-500">{r.user.name} ({r.user.email}) · {r.createdAt.toLocaleDateString("en-IN")}{r.isVerifiedPurchase && " · verified purchase"}</p>
            </li>
          ))}
          {reviews.length === 0 && <li className="py-3 text-sm text-ink-500">No reviews yet.</li>}
        </ul>
      </Panel>
    </AdminPage>
  );
}
