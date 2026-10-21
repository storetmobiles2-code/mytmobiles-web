import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { ContactLine, PolicyPage } from "@/components/layout/policy-page";
import { GrievanceOfficerCard } from "@/components/grievance/grievance-officer";

export const metadata: Metadata = { title: "Terms of use", alternates: { canonical: "/terms" } };
export const revalidate = 600;

export default async function TermsPage() {
  const s = await getSettings();
  const name = s.legalName || "myT Mobiles";
  return (
    <PolicyPage title="Terms of use">
      <p>These terms govern your use of this website and purchases from {name}. By placing an order you agree to them.</p>
      <h2>Products & pricing</h2>
      <ul>
        <li>Prices are in INR and include GST. MRP is shown as declared by the brand.</li>
        <li>Product images are official manufacturer images; actual colours may vary slightly on screen.</li>
        <li>Prices and stock are confirmed when you place your order. In the rare event of a pricing error, we will contact you and you may cancel for a full refund.</li>
        <li>Quantity limits per order may apply to prevent bulk purchases for resale.</li>
      </ul>
      <h2>Orders</h2>
      <p>An order is confirmed when you receive an order confirmation email (for online payments, after the payment succeeds). We may cancel orders we cannot fulfil (for example stock discrepancies or undeliverable addresses) and will refund any amount paid.</p>
      <h2>Demo / open-box units</h2>
      <p>Demo units are display products sold as-is at a reduced price. They may show signs of handling and are not eligible for return; brand warranty applies as available.</p>
      <h2>Returns & warranty</h2>
      <p>See our <Link href="/help/returns">Returns, replacement & refunds</Link> policy.</p>
      <h2>Accounts</h2>
      <p>Keep your password confidential. You are responsible for activity on your account. We may suspend accounts involved in fraud or abuse.</p>
      <h2>Trademarks</h2>
      <p>Product names, logos and images are trademarks of their respective owners and are used to identify the products we sell.</p>
      <h2>Contact & grievances</h2>
      <p>For questions, contact us <ContactLine email={s.supportEmail} phone={s.supportPhone} />.</p>
      <p>To make a complaint, use the <Link href="/help/grievance">complaints page</Link> or contact our grievance officer. Each complaint gets a ticket number, which you can use to track its status. Our grievance officer acknowledges the receipt of a complaint within 48 hours and redresses it within one month from the date of receipt, as required by the Consumer Protection (E-Commerce) Rules, 2020.</p>
      <GrievanceOfficerCard officer={{ name: s.grievanceOfficerName, designation: s.grievanceOfficerDesignation, email: s.grievanceOfficerEmail, phone: s.grievanceOfficerPhone }} showLink={false} />
    </PolicyPage>
  );
}
