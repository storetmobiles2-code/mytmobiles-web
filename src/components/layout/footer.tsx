import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getNavData, getPublicSettings } from "@/lib/public-data";

export async function Footer() {
  const [{ categories }, s] = await Promise.all([getNavData(), getPublicSettings()]);
  return (
    <footer className="mt-16 bg-brand-950 text-white/75">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo height={56} priority={false} />
          <p className="max-w-xs text-sm leading-6 text-white/60">
            Mobiles, TVs and home appliances at honest prices — with GST invoices, Cash on Delivery and secure online payments.
          </p>
          {(s.supportPhone || s.supportEmail) && (
            <div className="space-y-1 text-sm">
              {s.supportPhone && (
                <p>
                  Call us: <a className="font-semibold text-white hover:underline" href={`tel:${s.supportPhone.replace(/\s/g, "")}`}>{s.supportPhone}</a>
                </p>
              )}
              {s.supportEmail && (
                <p>
                  Email: <a className="font-semibold text-white hover:underline" href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a>
                </p>
              )}
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-brand-400 uppercase">Shop</h2>
          <ul className="space-y-2 text-sm">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/c/${c.slug}`} className="hover:text-white hover:underline">{c.name}</Link>
              </li>
            ))}
            <li><Link href="/offers" className="hover:text-white hover:underline">Offers & coupons</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-brand-400 uppercase">Help</h2>
          <ul className="space-y-2 text-sm">
            <li><Link href="/account/orders" className="hover:text-white hover:underline">Track your order</Link></li>
            <li><Link href="/help/shipping" className="hover:text-white hover:underline">Shipping & delivery</Link></li>
            <li><Link href="/help/returns" className="hover:text-white hover:underline">Returns, replacement & refunds</Link></li>
            <li><Link href="/help/payments" className="hover:text-white hover:underline">Payments & COD</Link></li>
            <li><Link href="/contact" className="hover:text-white hover:underline">Contact us</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-brand-400 uppercase">Company</h2>
          <ul className="space-y-2 text-sm">
            <li><Link href="/about" className="hover:text-white hover:underline">About myT Mobiles</Link></li>
            <li><Link href="/terms" className="hover:text-white hover:underline">Terms of use</Link></li>
            <li><Link href="/privacy" className="hover:text-white hover:underline">Privacy policy</Link></li>
          </ul>
          {s.address && <address className="mt-4 text-sm leading-6 not-italic text-white/60">{s.legalName || s.storeName}<br />{s.address}</address>}
          {s.gstin && <p className="mt-2 text-xs text-white/50">GSTIN: {s.gstin}</p>}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {s.legalName || "myT Mobiles"}. All rights reserved.</p>
          <p>Product names, logos and images are trademarks of their respective owners.</p>
        </div>
      </div>
    </footer>
  );
}
