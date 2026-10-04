import type { Metadata } from "next";
import { TicketPercent } from "lucide-react";
import { db } from "@/lib/db";
import { cardSelect } from "@/lib/catalog/queries";
import { formatINR } from "@/lib/money";
import { ProductGrid } from "@/components/product/product-card";
import { SectionHeading } from "@/components/ui/misc";
import { CopyCode } from "./copy-code";

export const metadata: Metadata = { title: "Offers & coupons", description: "Current coupon codes and the best deals at myT Mobiles.", alternates: { canonical: "/offers" } };
export const revalidate = 300;

export default async function OffersPage() {
  const now = new Date();
  const [coupons, deals] = await Promise.all([
    db.coupon.findMany({
      where: { isActive: true, isPublic: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] },
      orderBy: { createdAt: "desc" },
    }),
    db.product.findMany({ where: { isActive: true, inStock: true, discountPct: { gte: 10 } }, select: cardSelect, orderBy: { discountPct: "desc" }, take: 20 }),
  ]);
  const usable = coupons.filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit);
  return (
    <div className="container-page space-y-10 py-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Offers & coupons</h1>
        <p className="mt-1 text-sm text-ink-500">Apply coupon codes in your cart. Only one coupon can be used per order.</p>
      </div>
      <section aria-labelledby="coupons">
        <h2 id="coupons" className="sr-only">Coupons</h2>
        {usable.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {usable.map((c) => (
              <li key={c.id} className="card flex gap-4 p-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><TicketPercent className="h-6 w-6" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{c.type === "PERCENT" ? `${c.value}% off` : `${formatINR(c.value)} off`}{c.type === "PERCENT" && c.maxDiscount ? ` (up to ${formatINR(c.maxDiscount)})` : ""}</p>
                  <p className="text-sm text-ink-700">{c.description}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {c.minOrderValue > 0 && <>Min. order {formatINR(c.minOrderValue)} · </>}
                    {c.firstOrderOnly && <>First order only · </>}
                    {c.endsAt ? <>Valid till {c.endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</> : <>No expiry</>}
                  </p>
                  <CopyCode code={c.code} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card p-5 text-sm text-ink-500">There are no coupon codes running right now — but check out the deals below.</p>
        )}
      </section>
      {deals.length > 0 && (
        <section>
          <SectionHeading title="Deals on MRP" subtitle="Products priced 10% or more below MRP" />
          <ProductGrid products={deals} />
        </section>
      )}
    </div>
  );
}
