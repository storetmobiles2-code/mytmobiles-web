import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { PolicyPage } from "@/components/layout/policy-page";

export const metadata: Metadata = { title: "Contact us", alternates: { canonical: "/contact" } };
export const revalidate = 600;

export default async function ContactPage() {
  const s = await getSettings();
  const address = [s.addressLine1, s.addressLine2, s.city, [s.state, s.pincode].filter(Boolean).join(" ")].filter((x) => x && x.trim()).join(", ");
  return (
    <PolicyPage title="Contact us">
      <p>Questions about a product, your order, a demo unit or a return? We&apos;re happy to help.</p>
      <ul className="!ml-0 !list-none space-y-4">
        {s.supportPhone && <li className="flex items-center gap-3"><Phone className="h-5 w-5 text-brand-600" aria-hidden="true" /><a href={`tel:${s.supportPhone.replace(/\s/g, "")}`}>{s.supportPhone}</a></li>}
        {s.supportEmail && <li className="flex items-center gap-3"><Mail className="h-5 w-5 text-brand-600" aria-hidden="true" /><a href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a></li>}
        {address && <li className="flex items-start gap-3"><MapPin className="mt-1 h-5 w-5 text-brand-600" aria-hidden="true" /><span>{s.legalName || s.storeName}<br />{address}</span></li>}
      </ul>
      {!s.supportPhone && !s.supportEmail && !address && <p>Our contact details are being updated. For order help, open your order in <a href="/account/orders">My orders</a>.</p>}
      <p>For order-related queries, please keep your order number (e.g. MYT-261004-XXXXXX) handy.</p>
    </PolicyPage>
  );
}
