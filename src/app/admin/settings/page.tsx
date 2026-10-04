import { getSettings } from "@/lib/settings";
import { saveSettings } from "@/app/admin/actions/store";
import { STATE_NAMES } from "@/lib/indian-states";
import { razorpayConfigured, smtpConfigured, siteUrl } from "@/lib/env";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ActionForm, Field, inputCls } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const s = await getSettings();
  const r = (p: number) => p / 100;
  return (
    <AdminPage title="Store settings">
      <Panel title="Integrations">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">{razorpayConfigured() ? <Badge tone="success">Connected</Badge> : <Badge tone="warning">Not configured</Badge>} Razorpay online payments — set <code>RAZORPAY_KEY_ID</code>, <code>RAZORPAY_KEY_SECRET</code> and webhook secret; webhook URL: <code>{siteUrl("/api/payments/razorpay/webhook")}</code></li>
          <li className="flex items-center gap-2">{smtpConfigured() ? <Badge tone="success">Connected</Badge> : <Badge tone="warning">Not configured</Badge>} Transactional email (SMTP)</li>
        </ul>
      </Panel>
      <ActionForm action={saveSettings} submitLabel="Save settings" className="space-y-4">
        <Panel title="Business (appears on GST invoices)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Store name"><input name="storeName" defaultValue={s.storeName} className={inputCls} /></Field>
            <Field label="Registered legal name"><input name="legalName" defaultValue={s.legalName} className={inputCls} /></Field>
            <Field label="GSTIN"><input name="gstin" defaultValue={s.gstin} maxLength={15} className={`${inputCls} uppercase`} /></Field>
            <Field label="Invoice prefix" hint="Up to 4 letters; invoice numbers look like MYT/2627/000001"><input name="invoicePrefix" defaultValue={s.invoicePrefix} maxLength={4} className={`${inputCls} uppercase`} /></Field>
            <Field label="Support email"><input name="supportEmail" type="email" defaultValue={s.supportEmail} className={inputCls} /></Field>
            <Field label="Support phone"><input name="supportPhone" defaultValue={s.supportPhone} className={inputCls} /></Field>
            <Field label="Address line 1"><input name="addressLine1" defaultValue={s.addressLine1} className={inputCls} /></Field>
            <Field label="Address line 2"><input name="addressLine2" defaultValue={s.addressLine2} className={inputCls} /></Field>
            <Field label="City"><input name="city" defaultValue={s.city} className={inputCls} /></Field>
            <Field label="State" hint="Decides CGST+SGST (same state) vs IGST"><select name="state" defaultValue={s.state} className={inputCls}><option value="">Select…</option>{STATE_NAMES.map((n) => <option key={n}>{n}</option>)}</select></Field>
            <Field label="Dispatch pincode" hint="Used for delivery-time estimates"><input name="pincode" defaultValue={s.pincode} maxLength={6} className={inputCls} /></Field>
          </div>
        </Panel>
        <Panel title="Delivery & payment rules">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Free delivery from (₹)"><input name="freeShippingThreshold" inputMode="decimal" defaultValue={r(s.freeShippingThreshold)} className={inputCls} /></Field>
            <Field label="Delivery fee below that (₹)"><input name="shippingFee" inputMode="decimal" defaultValue={r(s.shippingFee)} className={inputCls} /></Field>
            <Field label="Unpaid order hold (minutes)"><input name="paymentWindowMinutes" type="number" defaultValue={s.paymentWindowMinutes} className={inputCls} /></Field>
            <Field label="COD fee (₹)"><input name="codFee" inputMode="decimal" defaultValue={r(s.codFee)} className={inputCls} /></Field>
            <Field label="COD max order value (₹)"><input name="codMaxOrderValue" inputMode="decimal" defaultValue={r(s.codMaxOrderValue)} className={inputCls} /></Field>
            <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" name="codEnabled" defaultChecked={s.codEnabled} className="h-4 w-4 accent-brand-600" /> Offer Cash on Delivery</label>
            <Field label="Days: same city"><input name="deliveryDaysLocal" type="number" defaultValue={s.deliveryDaysLocal} className={inputCls} /></Field>
            <Field label="Days: same state"><input name="deliveryDaysState" type="number" defaultValue={s.deliveryDaysState} className={inputCls} /></Field>
            <Field label="Days: rest of India"><input name="deliveryDaysNational" type="number" defaultValue={s.deliveryDaysNational} className={inputCls} /></Field>
            <Field label="Days: remote areas"><input name="deliveryDaysRemote" type="number" defaultValue={s.deliveryDaysRemote} className={inputCls} /></Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Remote pincode prefixes" hint="Comma separated"><textarea name="remotePincodePrefixes" defaultValue={s.remotePincodePrefixes.join(", ")} className="mt-1 h-20 w-full rounded-xl border border-ink-300 p-2 text-sm" /></Field>
            <Field label="Non-serviceable pincodes"><textarea name="blockedPincodes" defaultValue={s.blockedPincodes.join(", ")} className="mt-1 h-20 w-full rounded-xl border border-ink-300 p-2 text-sm" /></Field>
            <Field label="No-COD pincodes"><textarea name="codBlockedPincodes" defaultValue={s.codBlockedPincodes.join(", ")} className="mt-1 h-20 w-full rounded-xl border border-ink-300 p-2 text-sm" /></Field>
          </div>
        </Panel>
      </ActionForm>
    </AdminPage>
  );
}
