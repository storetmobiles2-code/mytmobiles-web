import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ReviewForm } from "@/components/product/review-form";
import { ProductImage } from "@/components/product/product-image";

export const metadata: Metadata = { title: "Write a review", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewPage(props: PageProps<"/p/[slug]/review">) {
  const { slug } = await props.params;
  const user = await requireUser(`/p/${slug}/review`);
  const product = await db.product.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, images: { take: 1, orderBy: { sortOrder: "asc" } } } });
  if (!product) notFound();
  const [purchased, existing] = await Promise.all([
    db.orderItem.findFirst({ where: { productId: product.id, order: { userId: user.id, status: { in: ["DELIVERED", "RETURN_REQUESTED", "RETURNED"] } } }, select: { id: true } }),
    db.review.findUnique({ where: { productId_userId: { productId: product.id, userId: user.id } } }),
  ]);
  return (
    <div className="container-page flex justify-center py-8">
      <div className="card w-full max-w-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-16"><ProductImage image={product.images[0]} name={product.name} sizes="64px" /></div>
          <div><p className="text-sm text-ink-500">Reviewing</p><Link href={`/p/${product.slug}`} className="font-bold hover:text-brand-700">{product.name}</Link></div>
        </div>
        <div className="mt-6">
          {purchased ? (
            <ReviewForm productId={product.id} existing={existing ?? undefined} />
          ) : (
            <p className="rounded-xl bg-ink-100 px-4 py-3 text-sm text-ink-700">Only customers who have received this product from myT Mobiles can review it. Once your order is delivered, you&apos;ll be able to share your experience here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
