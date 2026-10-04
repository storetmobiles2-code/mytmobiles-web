import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { PolicyPage } from "@/components/layout/policy-page";

export const metadata: Metadata = { title: "About us", alternates: { canonical: "/about" } };
export const revalidate = 600;

export default async function AboutPage() {
  const s = await getSettings();
  return (
    <PolicyPage title="About myT Mobiles">
      <p>myT Mobiles is {s.city ? <>a mobile and electronics store based in {s.city}{s.state ? `, ${s.state}` : ""}</> : "a mobile and electronics store"}. We sell smartphones, tablets, smart TVs, air coolers and accessories from brands including Samsung, Redmi, Apple, OPPO, vivo and more.</p>
      <h2>Why shop with us</h2>
      <ul>
        <li>Genuine products with a GST tax invoice on every order.</li>
        <li>Clear prices — inclusive of GST, with the brand&apos;s MRP shown where available.</li>
        <li>Cash on Delivery and secure online payments.</li>
        <li>Open-box demo units at lower prices, clearly labelled.</li>
      </ul>
      {(s.legalName || s.gstin) && (
        <>
          <h2>Business details</h2>
          <p>{s.legalName}{s.gstin && <><br />GSTIN: {s.gstin}</>}</p>
        </>
      )}
    </PolicyPage>
  );
}
