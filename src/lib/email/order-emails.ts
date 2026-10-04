import "server-only";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { formatINR } from "@/lib/money";
import { formatDeliveryDate } from "@/lib/delivery";
import { sendMail } from "./mailer";
import { button, emailLayout, escapeHtml } from "./layout";

type Kind = "placed" | "shipped" | "out_for_delivery" | "delivered" | "cancelled";

const COPY: Record<Kind, { subject: (n: string) => string; heading: string; intro: string }> = {
  placed: { subject: (n) => `Order confirmed — ${n}`, heading: "Thanks! Your order is confirmed.", intro: "We've received your order and will notify you when it ships." },
  shipped: { subject: (n) => `Shipped — ${n}`, heading: "Your order is on its way", intro: "Your order has been handed to our courier partner." },
  out_for_delivery: { subject: (n) => `Out for delivery — ${n}`, heading: "Arriving today", intro: "Your order is out for delivery. Please keep your phone reachable." },
  delivered: { subject: (n) => `Delivered — ${n}`, heading: "Delivered!", intro: "Your order has been delivered. We hope you love it." },
  cancelled: { subject: (n) => `Order cancelled — ${n}`, heading: "Your order was cancelled", intro: "Your order has been cancelled. If you paid online, the refund goes back to the original payment method in 5–7 working days." },
};

export async function sendOrderEmail(orderId: string, kind: Kind): Promise<void> {
  try {
    const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true, user: { select: { name: true } } } });
    if (!order) return;
    const c = COPY[kind];
    const url = siteUrl(`/account/orders/${order.id}`);
    const rows = order.items
      .map(
        (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(i.productName)}${i.variantLabel ? `<br><span style="color:#6b6b80;font-size:13px">${escapeHtml(i.variantLabel)}</span>` : ""}<br><span style="color:#6b6b80;font-size:13px">Qty ${i.quantity}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #eee;white-space:nowrap">${formatINR(i.lineTotal)}</td></tr>`,
      )
      .join("");
    const tracking =
      kind === "shipped" && order.trackingNumber
        ? `<p><strong>Courier:</strong> ${escapeHtml(order.courierName ?? "")}<br><strong>Tracking no.:</strong> ${escapeHtml(order.trackingNumber)}${order.trackingUrl ? `<br><a href="${escapeHtml(order.trackingUrl)}">Track shipment</a>` : ""}</p>`
        : "";
    const eta =
      (kind === "placed" || kind === "shipped") && order.estimatedDeliveryTo
        ? `<p><strong>Expected delivery:</strong> by ${formatDeliveryDate(order.estimatedDeliveryTo)}</p>`
        : "";
    const html = emailLayout({
      storeName: "myT Mobiles",
      preheader: `${c.heading} Order ${order.orderNumber}`,
      heading: c.heading,
      bodyHtml: `<p>Hi ${escapeHtml(order.user.name.split(" ")[0])}, ${c.intro}</p>
<p style="color:#6b6b80;font-size:13px">Order <strong>${order.orderNumber}</strong> · ${order.paymentMethod === "COD" ? "Cash on Delivery" : "Paid online"}</p>
${eta}${tracking}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
<tr><td style="padding:10px 0;font-weight:700">Order total</td><td align="right" style="padding:10px 0;font-weight:700">${formatINR(order.total)}</td></tr></table>
<p style="font-size:13px;color:#6b6b80">Delivering to ${escapeHtml(order.shipName)}, ${escapeHtml(order.shipCity)} ${escapeHtml(order.shipPincode)}</p>
${button(url, "View order")}`,
    });
    const text = `${c.heading}\n\nOrder ${order.orderNumber}\n${order.items.map((i) => `- ${i.productName} ×${i.quantity}: ${formatINR(i.lineTotal)}`).join("\n")}\nTotal: ${formatINR(order.total)}\n\nView your order: ${url}`;
    await sendMail({ to: order.email, subject: c.subject(order.orderNumber), html, text });
  } catch (err) {
    console.error(`[mail] order email ${kind} failed for ${orderId}`, err);
  }
}
