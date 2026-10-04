import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { razorpayConfigured } from "@/lib/env";
import { formatINR } from "@/lib/money";
import { PolicyPage } from "@/components/layout/policy-page";

export const metadata: Metadata = { title: "Payments & Cash on Delivery", alternates: { canonical: "/help/payments" } };
export const revalidate = 600;

export default async function PaymentsPage() {
  const s = await getSettings();
  const online = razorpayConfigured();
  return (
    <PolicyPage title="Payments & Cash on Delivery">
      <h2>Payment options</h2>
      <ul>
        {online && <li><strong>Pay online</strong> — UPI, debit/credit cards, net banking and wallets, processed securely by Razorpay. We never see or store your card details.</li>}
        {s.codEnabled && <li><strong>Cash on Delivery</strong> — pay when your order arrives, on eligible pincodes and orders up to {formatINR(s.codMaxOrderValue)}{s.codFee > 0 ? ` (COD fee ${formatINR(s.codFee)})` : ""}.</li>}
        {!online && !s.codEnabled && <li>Payment options are being set up. Please contact us to place an order.</li>}
      </ul>
      <h2>Prices & GST</h2>
      <p>All prices are in Indian Rupees and include GST. Every order comes with a GST tax invoice, issued when your order is dispatched. To claim input tax credit, enter your GSTIN and registered business name at checkout.</p>
      {online && (
        <>
          <h2>If a payment fails</h2>
          <p>If money was debited but your order shows <em>Awaiting payment</em>, don&apos;t worry — we confirm payments directly with Razorpay, so the order updates automatically within a few minutes. Your items are held for {s.paymentWindowMinutes} minutes while you complete payment; unpaid orders after that are cancelled and any amount debited is refunded by Razorpay.</p>
        </>
      )}
    </PolicyPage>
  );
}
