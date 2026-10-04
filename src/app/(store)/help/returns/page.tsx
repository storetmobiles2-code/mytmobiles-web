import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { ContactLine, PolicyPage } from "@/components/layout/policy-page";

export const metadata: Metadata = { title: "Returns, Replacement & Refunds", alternates: { canonical: "/help/returns" } };
export const revalidate = 600;

export default async function ReturnsPage() {
  const s = await getSettings();
  return (
    <PolicyPage title="Returns, replacement & refunds">
      <h2>When can I return a product?</h2>
      <p>New products can be returned within <strong>7 days of delivery</strong> if they are:</p>
      <ul>
        <li>damaged in transit,</li>
        <li>defective (manufacturing fault), or</li>
        <li>different from what you ordered (wrong model, colour or variant).</li>
      </ul>
      <p>The product must be returned with its original box, all accessories, free gifts, manuals and the invoice. Phones must not be physically damaged and must have Google/Apple/Samsung accounts and screen locks removed.</p>
      <h2>What isn&apos;t returnable</h2>
      <ul>
        <li><strong>Demo / open-box units</strong> — sold as-is at a lower price and not eligible for returns. Manufacturing defects are handled under the brand warranty.</li>
        <li>Change of mind after the product has been used or activated.</li>
        <li>Physical or liquid damage after delivery.</li>
      </ul>
      <h2>How to request a return</h2>
      <ol className="ml-5 list-decimal space-y-1">
        <li>Go to <Link href="/account/orders">My orders</Link>, open the order and choose <em>Request return / replacement</em>.</li>
        <li>Describe the issue. Our team will contact you to arrange pickup and inspection.</li>
        <li>For defects in electronics, the brand&apos;s authorised service centre may need to verify the fault (a DOA certificate) as per brand policy.</li>
      </ol>
      <h2>Refunds</h2>
      <ul>
        <li><strong>Online payments:</strong> refunded to the original payment method. Banks usually take 5–7 working days to reflect it.</li>
        <li><strong>Cash on Delivery:</strong> refunded by bank transfer (NEFT/IMPS) to an account you provide.</li>
        <li><strong>Cancelled before dispatch:</strong> prepaid amounts are refunded automatically.</li>
      </ul>
      <h2>Cancellations</h2>
      <p>You can cancel an order from <Link href="/account/orders">My orders</Link> any time before it is shipped. Once shipped, you can refuse the delivery or request a return as above.</p>
      <h2>Warranty</h2>
      <p>Products carry the manufacturer&apos;s warranty. Warranty claims are handled at the brand&apos;s authorised service centres; keep your tax invoice as proof of purchase.</p>
      <h2>Need help?</h2>
      <p>Contact us <ContactLine email={s.supportEmail} phone={s.supportPhone} />.</p>
    </PolicyPage>
  );
}
