import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildGstr1Report, type Gstr1Order, type Gstr1Report, type ReportMonth, type StoreInfo } from "./gstr1";

/**
 * Loads every order that matters for the month: invoiced in it, placed in it,
 * or cancelled or returned in it. Read-only.
 */
export async function loadGstr1Report(month: ReportMonth): Promise<{ report: Gstr1Report; store: StoreInfo }> {
  const range = { gte: month.start, lt: month.end };
  const [settings, rows] = await Promise.all([
    getSettings(),
    db.order.findMany({
      where: {
        OR: [
          { invoicedAt: range },
          { placedAt: range },
          { cancelledAt: range },
          { events: { some: { status: "RETURNED", createdAt: range } } },
        ],
      },
      select: {
        orderNumber: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        shipName: true,
        buyerCompany: true,
        buyerGstin: true,
        shipState: true,
        isInterState: true,
        subtotal: true,
        couponDiscount: true,
        shippingFee: true,
        codFee: true,
        total: true,
        taxableValue: true,
        cgst: true,
        sgst: true,
        igst: true,
        invoiceNumber: true,
        invoicedAt: true,
        placedAt: true,
        cancelledAt: true,
        items: { select: { productName: true, hsnCode: true, gstRateBps: true, quantity: true, taxableValue: true, taxAmount: true }, orderBy: { id: "asc" } },
        payments: { select: { refundedAmount: true } },
        events: { where: { status: "RETURNED" }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const orders: Gstr1Order[] = rows.map(({ payments, events, ...o }) => ({
    ...o,
    returnedAt: events[0]?.createdAt ?? null,
    refundedAmount: payments.reduce((s, p) => s + p.refundedAmount, 0),
  }));
  const store: StoreInfo = { gstin: settings.gstin, state: settings.state };
  return { report: buildGstr1Report(orders, month, store), store };
}
