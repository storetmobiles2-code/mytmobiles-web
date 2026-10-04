import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { ContactLine, PolicyPage } from "@/components/layout/policy-page";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };
export const revalidate = 600;

export default async function PrivacyPage() {
  const s = await getSettings();
  const name = s.legalName || "myT Mobiles";
  return (
    <PolicyPage title="Privacy policy">
      <p>This policy explains how {name} (&quot;we&quot;) collects and uses personal data on this website, in line with India&apos;s Digital Personal Data Protection Act, 2023 and the IT Act, 2000.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> name, email, mobile number and a securely hashed password.</li>
        <li><strong>Order details:</strong> delivery addresses, items purchased, GSTIN (if you provide one) and payment status.</li>
        <li><strong>Payment data:</strong> processed by Razorpay. We receive a payment reference and status — never your full card, UPI PIN or bank credentials.</li>
        <li><strong>Usage data:</strong> anonymous page and product views to improve the store. We do not use advertising cookies; a per-tab identifier is stored only in your browser session.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To process, deliver and support your orders, including GST invoicing as required by law.</li>
        <li>To send order and account emails. Promotional emails are sent only if you opt in, and you can opt out any time from your profile.</li>
        <li>To prevent fraud and abuse (for example rate-limiting sign-in attempts).</li>
      </ul>
      <h2>Sharing</h2>
      <p>We share only what&apos;s needed with service providers who act on our behalf: our courier partners (name, phone, address), Razorpay (payment processing) and our email provider. We do not sell personal data.</p>
      <h2>Retention</h2>
      <p>We keep order and invoice records for the period required by GST law (currently at least 6 years from the end of the financial year). Other data is kept while your account is active.</p>
      <h2>Your rights</h2>
      <p>You can access and correct your details from your account, and request erasure of your account (subject to legal record-keeping obligations). Contact us <ContactLine email={s.supportEmail} phone={s.supportPhone} />.</p>
    </PolicyPage>
  );
}
