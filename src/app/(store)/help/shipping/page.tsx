import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { formatINR } from "@/lib/money";
import { PolicyPage } from "@/components/layout/policy-page";

export const metadata: Metadata = { title: "Shipping & Delivery", alternates: { canonical: "/help/shipping" } };
export const revalidate = 600;

export default async function ShippingPage() {
  const s = await getSettings();
  return (
    <PolicyPage title="Shipping & delivery">
      <h2>Where we deliver</h2>
      <p>We deliver across India to serviceable pincodes. Enter your pincode on any product page or in your cart to see whether we deliver there, the estimated delivery dates and whether Cash on Delivery is available.</p>
      <h2>Delivery charges</h2>
      <ul>
        <li>{s.freeShippingThreshold > 0 ? <>Free delivery on orders of {formatINR(s.freeShippingThreshold)} or more (after coupon discounts).</> : <>Delivery is free on all orders.</>}</li>
        {s.freeShippingThreshold > 0 && <li>A delivery charge of {formatINR(s.shippingFee)} applies to smaller orders.</li>}
        {s.codEnabled && s.codFee > 0 && <li>A Cash on Delivery fee of {formatINR(s.codFee)} applies to COD orders.</li>}
      </ul>
      <h2>Delivery timelines</h2>
      <p>Estimated delivery depends on your location:</p>
      <ul>
        <li>Within our city: about {s.deliveryDaysLocal}–{s.deliveryDaysLocal + 1} working day(s)</li>
        <li>Within {s.state || "our state"}: about {s.deliveryDaysState}–{s.deliveryDaysState + 2} working days</li>
        <li>Rest of India: about {s.deliveryDaysNational}–{s.deliveryDaysNational + 2} working days</li>
        <li>North-East, Jammu & Kashmir, Ladakh and island territories: about {s.deliveryDaysRemote}–{s.deliveryDaysRemote + 2} working days</li>
      </ul>
      <p>Orders placed after 2 PM are dispatched the next working day. Sundays and public holidays are not counted. Estimates are shown at checkout and in your order details.</p>
      <h2>Tracking your order</h2>
      <p>Once your order ships, we email you the courier name and tracking number. You can also see live status in <Link href="/account/orders">My orders</Link>.</p>
      <h2>At delivery</h2>
      <ul>
        <li>Please check that the package is sealed and undamaged before accepting it. If it looks tampered with, refuse delivery and contact us.</li>
        <li>For expensive items we recommend recording an unboxing video — it helps us resolve any transit-damage claims quickly.</li>
        <li>High-value orders may require an OTP or ID verification at delivery.</li>
      </ul>
    </PolicyPage>
  );
}
