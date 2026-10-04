import "server-only";
import { db } from "@/lib/db";
import { razorpayConfigured } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { estimateDelivery } from "@/lib/delivery";
import { lookupPincode } from "@/lib/pincode";
import { isInterStateSupply } from "@/lib/gst";
import { allocateDiscount, computeInvoiceTax, computeTotals, evaluateCoupon, lineIsEligible, type PricingLine } from "@/lib/pricing";
import { getCartView, toPricingLines } from "@/lib/cart";
import { refreshProductAggregates } from "@/lib/catalog/queries";
import * as razorpay from "@/lib/payments/razorpay";
import { trackServer } from "@/lib/analytics";
import { sendOrderEmail } from "@/lib/email/order-emails";
import { financialYear, formatInvoiceNumber, generateOrderNumber } from "./numbers";
import { ADMIN_CANCELLABLE, canTransition, CUSTOMER_CANCELLABLE } from "./status";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

type Tx = Prisma.TransactionClient;

export interface PlaceOrderInput {
  addressId: string;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  buyerGstin?: string;
  buyerCompany?: string;
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  paymentMethod: PaymentMethod;
}

/** Returns stock for every line of an order and logs it. */
async function restock(tx: Tx, orderId: string, reason: string, actorId: string | null) {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true, productId: true } });
  for (const item of items) {
    if (!item.variantId) continue;
    await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
    await tx.inventoryLog.create({
      data: { variantId: item.variantId, delta: item.quantity, reason, orderId, actorId },
    });
  }
  return items.map((i) => i.productId).filter((x): x is string => Boolean(x));
}

/** Gives back the coupon use when an order is cancelled before fulfilment. */
async function releaseCoupon(tx: Tx, orderId: string) {
  const redemption = await tx.couponRedemption.findUnique({ where: { orderId } });
  if (!redemption) return;
  await tx.couponRedemption.delete({ where: { id: redemption.id } });
  await tx.coupon.update({ where: { id: redemption.couponId }, data: { usedCount: { decrement: 1 } } });
}

/** Cancels a user's earlier unpaid online orders so their stock is released before a new attempt. */
async function supersedePendingOrders(userId: string) {
  const pending = await db.order.findMany({
    where: { userId, status: "PENDING_PAYMENT" },
    select: { id: true },
  });
  for (const o of pending) {
    await cancelOrder(o.id, { reason: "Replaced by a newer checkout attempt", actor: null, notifyCustomer: false }).catch(
      (err) => console.error(`[orders] could not supersede ${o.id}`, err),
    );
  }
}

export async function placeOrder(user: SessionUser, input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.userId !== user.id) throw new OrderError("Could not place the order. Please refresh and try again.");
    return { orderId: existing.id, orderNumber: existing.orderNumber, paymentMethod: existing.paymentMethod };
  }

  const [settings, address, cart] = await Promise.all([
    getSettings(),
    db.address.findFirst({ where: { id: input.addressId, userId: user.id } }),
    getCartView(input.paymentMethod),
  ]);
  if (!address) throw new OrderError("Please choose a delivery address.");
  if (cart.lines.length === 0) throw new OrderError("Your cart is empty.");
  if (cart.hasIssues) throw new OrderError("Some items in your cart need attention before you can place the order.");
  if (cart.couponError) throw new OrderError(`Coupon: ${cart.couponError} Remove it to continue.`);

  const pin = await lookupPincode(address.pincode);
  if (pin.isValid === false) throw new OrderError(`Pincode ${address.pincode} doesn't exist. Please correct the address.`);
  if (pin.state && pin.state !== address.state)
    throw new OrderError(`Pincode ${address.pincode} is in ${pin.state}, but the address says ${address.state}. Please correct the address.`);
  const estimate = estimateDelivery(address.pincode, address.state, settings);
  if (!estimate.serviceable) throw new OrderError(`Sorry, we don't deliver to ${address.pincode} yet.`);

  if (input.paymentMethod === "COD") {
    if (!estimate.codAvailable) throw new OrderError("Cash on Delivery isn't available for this pincode.");
    if (cart.totals.total > settings.codMaxOrderValue)
      throw new OrderError("Cash on Delivery isn't available for orders of this value. Please pay online.");
  } else if (!razorpayConfigured()) {
    throw new OrderError("Online payment is temporarily unavailable. Please choose Cash on Delivery.");
  }

  await supersedePendingOrders(user.id);

  // Build pricing lines from the database (never from the client).
  const products = await db.product.findMany({
    where: { id: { in: cart.lines.map((l) => l.productId) } },
    select: { id: true, categoryId: true, brandId: true, gstRateBps: true, hsnCode: true },
  });
  const pmeta = new Map(products.map((p) => [p.id, p]));
  const pricingLines: PricingLine[] = toPricingLines(cart.lines, pmeta);

  const couponRule = cart.coupon ? await db.coupon.findUnique({ where: { code: cart.coupon.code } }) : null;
  let couponDiscount = 0;
  if (couponRule) {
    const [userRedemptions, userPaidOrders] = await Promise.all([
      db.couponRedemption.count({ where: { couponId: couponRule.id, userId: user.id } }),
      db.order.count({ where: { userId: user.id, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } } }),
    ]);
    const r = evaluateCoupon(couponRule, pricingLines, { now: new Date(), userRedemptions, userPaidOrders });
    if (!r.ok) throw new OrderError(`Coupon: ${r.reason}`);
    couponDiscount = r.discount;
  }

  const totals = computeTotals(pricingLines, settings, { couponDiscount, paymentMethod: input.paymentMethod });
  const isInterState = isInterStateSupply(settings.state, address.state);
  const lineValues = pricingLines.map((l) => l.unitPrice * l.quantity);
  const shares = allocateDiscount(
    lineValues,
    pricingLines.map((l) => (couponRule ? lineIsEligible(l, couponRule) : false)),
    couponDiscount,
  );
  // Delivery/COD charges form a composite supply taxed at the principal item's rate.
  const principalRate = Math.max(...pricingLines.map((l) => l.gstRateBps));
  const tax = computeInvoiceTax(
    [
      ...pricingLines.map((l, i) => ({ amountInclusive: lineValues[i] - shares[i], gstRateBps: l.gstRateBps })),
      { amountInclusive: totals.shippingFee + totals.codFee, gstRateBps: principalRate },
    ],
    isInterState,
  );

  const isCod = input.paymentMethod === "COD";
  const now = new Date();

  const order = await db.$transaction(
    async (tx) => {
      // Reserve stock atomically; fails if anyone else bought the last unit first.
      for (const l of pricingLines) {
        const updated = await tx.productVariant.updateMany({
          where: { id: l.variantId, isActive: true, stock: { gte: l.quantity } },
          data: { stock: { decrement: l.quantity } },
        });
        if (updated.count !== 1) {
          const line = cart.lines.find((c) => c.variantId === l.variantId);
          throw new OrderError(`${line?.name ?? "An item"} just went out of stock. Please review your cart.`);
        }
      }

      if (couponRule) {
        const claimed = await tx.coupon.updateMany({
          where: {
            id: couponRule.id,
            isActive: true,
            ...(couponRule.usageLimit !== null ? { usedCount: { lt: couponRule.usageLimit } } : {}),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count !== 1) throw new OrderError("This coupon has just reached its usage limit.");
      }

      let orderNumber = generateOrderNumber(now);
      while (await tx.order.findUnique({ where: { orderNumber }, select: { id: true } })) orderNumber = generateOrderNumber(now);

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: user.id,
          status: isCod ? "CONFIRMED" : "PENDING_PAYMENT",
          paymentMethod: input.paymentMethod,
          paymentStatus: "PENDING",
          email: user.email,
          shipName: address.fullName,
          shipPhone: address.phone,
          shipLine1: address.line1,
          shipLine2: address.line2,
          shipLandmark: address.landmark,
          shipCity: address.city,
          shipState: address.state,
          shipPincode: address.pincode,
          buyerGstin: input.buyerGstin || null,
          buyerCompany: input.buyerCompany || null,
          mrpTotal: totals.mrpTotal,
          subtotal: totals.subtotal,
          couponCode: couponRule?.code ?? null,
          couponDiscount,
          shippingFee: totals.shippingFee,
          codFee: totals.codFee,
          total: totals.total,
          taxableValue: tax.taxableValue,
          cgst: tax.cgst,
          sgst: tax.sgst,
          igst: tax.igst,
          isInterState,
          estimatedDeliveryFrom: estimate.from,
          estimatedDeliveryTo: estimate.to,
          idempotencyKey: input.idempotencyKey,
          paymentExpiresAt: isCod ? null : new Date(now.getTime() + settings.paymentWindowMinutes * 60_000),
          confirmedAt: isCod ? now : null,
          items: {
            create: pricingLines.map((l, i) => {
              const view = cart.lines.find((c) => c.variantId === l.variantId)!;
              return {
                productId: l.productId,
                variantId: l.variantId,
                productName: view.name,
                productSlug: view.slug,
                variantLabel: view.variantLabel || null,
                sku: view.sku,
                imageUrl: view.image?.url ?? null,
                hsnCode: pmeta.get(l.productId)!.hsnCode,
                gstRateBps: l.gstRateBps,
                mrp: l.mrp,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                lineTotal: lineValues[i],
                discount: shares[i],
                taxableValue: tax.lines[i].taxableValue,
                taxAmount: tax.lines[i].taxAmount,
              };
            }),
          },
          payments: {
            create: { provider: isCod ? "COD" : "RAZORPAY", amount: totals.total, status: "PENDING" },
          },
          events: {
            create: {
              status: isCod ? "CONFIRMED" : "PENDING_PAYMENT",
              message: isCod ? "Order placed with Cash on Delivery." : "Order created. Waiting for online payment.",
            },
          },
        },
      });

      if (couponRule) {
        await tx.couponRedemption.create({
          data: { couponId: couponRule.id, userId: user.id, orderId: created.id, amount: couponDiscount },
        });
      }
      for (const l of pricingLines) {
        await tx.inventoryLog.create({
          data: { variantId: l.variantId, delta: -l.quantity, reason: "Order reserved", orderId: created.id },
        });
      }
      if (isCod) await clearCart(tx, user.id);
      await refreshProductAggregates(pricingLines.map((l) => l.productId), tx);
      return created;
    },
    { isolationLevel: "ReadCommitted", timeout: 20_000 },
  );

  if (isCod) {
    void sendOrderEmail(order.id, "placed");
    void trackServer({ name: "purchase", userId: user.id, value: order.total, props: { orderNumber: order.orderNumber, method: "COD" } });
  }
  return { orderId: order.id, orderNumber: order.orderNumber, paymentMethod: order.paymentMethod };
}

async function clearCart(tx: Tx, userId: string) {
  const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
  if (!cart) return;
  await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
  await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
}

/**
 * Creates (or reuses) the Razorpay order for an unpaid order and returns what
 * Checkout.js needs. Amount always comes from our database.
 */
export async function startOnlinePayment(orderId: string, userId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: { payments: { where: { provider: "RAZORPAY" }, orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw new OrderError("Order not found.");
  if (order.status !== "PENDING_PAYMENT") throw new OrderError("This order no longer needs payment.");
  if (order.paymentExpiresAt && order.paymentExpiresAt < new Date()) {
    await cancelOrder(order.id, { reason: "Payment window expired", actor: null, notifyCustomer: false });
    throw new OrderError("The payment window for this order has expired. Please place the order again.");
  }

  let payment = order.payments.find((p) => p.providerOrderId && p.status === "PENDING") ?? null;
  if (!payment) {
    const rzp = await razorpay.createOrder(order.total, order.orderNumber, { orderId: order.id, orderNumber: order.orderNumber });
    const pending = order.payments.find((p) => !p.providerOrderId && p.status === "PENDING");
    payment = pending
      ? await db.payment.update({ where: { id: pending.id }, data: { providerOrderId: rzp.id } })
      : await db.payment.create({
          data: { orderId: order.id, provider: "RAZORPAY", providerOrderId: rzp.id, amount: order.total, status: "PENDING" },
        });
  }
  return { order, razorpayOrderId: payment.providerOrderId! };
}

/**
 * Idempotently marks an order paid. Called from both the client callback
 * (after signature verification) and the webhook — whichever arrives first.
 */
export async function markOrderPaid(params: { providerOrderId: string; providerPaymentId: string; method?: string; amount: number }) {
  const payment = await db.payment.findUnique({ where: { providerOrderId: params.providerOrderId }, include: { order: true } });
  if (!payment) throw new OrderError(`Unknown Razorpay order ${params.providerOrderId}`);
  if (params.amount !== payment.amount) {
    console.error(`[payments] amount mismatch for ${payment.order.orderNumber}: expected ${payment.amount}, got ${params.amount}`);
    throw new OrderError("Payment amount mismatch.");
  }
  if (payment.status === "PAID") return payment.order;

  const order = payment.order;
  if (order.status === "CANCELLED") {
    // Paid after the order expired: try to revive it, otherwise refund automatically.
    const revived = await db.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
      // Any throw rolls back every decrement made so far.
      for (const i of items) {
        if (!i.variantId) throw new Error("NO_VARIANT");
        const r = await tx.productVariant.updateMany({ where: { id: i.variantId, isActive: true, stock: { gte: i.quantity } }, data: { stock: { decrement: i.quantity } } });
        if (r.count !== 1) throw new Error("NO_STOCK");
        await tx.inventoryLog.create({ data: { variantId: i.variantId, delta: -i.quantity, reason: "Late payment — order restored", orderId: order.id } });
      }
      await refreshProductAggregates(items.map((i) => i.productId).filter((x): x is string => Boolean(x)), tx);
      return true;
    }).catch(() => false);

    await db.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", providerPaymentId: params.providerPaymentId, method: params.method },
    });
    if (!revived) {
      await refundOrderPayment(order.id, "Payment received after the order was cancelled");
      return order;
    }
    await db.order.update({
      where: { id: order.id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
        confirmedAt: new Date(),
        cancelledAt: null,
        cancelReason: null,
        paymentExpiresAt: null,
        events: { create: { status: "CONFIRMED", message: "Payment received late — order restored." } },
      },
    });
  } else {
    const updated = await db.$transaction(async (tx) => {
      const claim = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: "PAID" } },
        data: { status: "PAID", providerPaymentId: params.providerPaymentId, method: params.method, failureReason: null },
      });
      if (claim.count === 0) return false; // Another request already processed it.
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: order.status === "PENDING_PAYMENT" ? "CONFIRMED" : order.status,
          paymentStatus: "PAID",
          confirmedAt: order.confirmedAt ?? new Date(),
          paymentExpiresAt: null,
          events: { create: { status: "CONFIRMED", message: `Payment received${params.method ? ` via ${params.method.toUpperCase()}` : ""}.` } },
        },
      });
      await clearCart(tx, order.userId);
      return true;
    });
    if (!updated) return order;
  }

  void sendOrderEmail(order.id, "placed");
  void trackServer({ name: "purchase", userId: order.userId, value: order.total, props: { orderNumber: order.orderNumber, method: "RAZORPAY" } });
  return order;
}

export async function recordPaymentFailure(providerOrderId: string, reason: string) {
  await db.payment.updateMany({
    where: { providerOrderId, status: "PENDING" },
    data: { failureReason: reason.slice(0, 500) },
  });
}

/** Verifies a Checkout.js success callback and confirms the order. */
export async function verifyAndConfirmPayment(
  userId: string,
  orderId: string,
  body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
) {
  const payment = await db.payment.findFirst({
    where: { providerOrderId: body.razorpay_order_id, order: { id: orderId, userId } },
  });
  if (!payment) throw new OrderError("Payment does not match this order.");
  if (!razorpay.verifyPaymentSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
    throw new OrderError("Payment verification failed. If money was debited, it will be refunded automatically.");
  }
  let rp = await razorpay.fetchPayment(body.razorpay_payment_id);
  if (rp.order_id !== body.razorpay_order_id) throw new OrderError("Payment does not match this order.");
  if (rp.status === "authorized") rp = await razorpay.capturePayment(rp.id, rp.amount);
  if (rp.status !== "captured") throw new OrderError("Payment was not completed.");
  return markOrderPaid({ providerOrderId: rp.order_id, providerPaymentId: rp.id, method: rp.method, amount: rp.amount });
}

/** Issues a full Razorpay refund for a paid order. */
async function refundOrderPayment(orderId: string, reason: string) {
  const payment = await db.payment.findFirst({ where: { orderId, provider: "RAZORPAY", status: "PAID" } });
  if (!payment?.providerPaymentId) return;
  try {
    const refund = await razorpay.refundPayment(payment.providerPaymentId, payment.amount - payment.refundedAmount, { orderId, reason });
    await db.payment.update({
      where: { id: payment.id },
      data: { status: refund.status === "processed" ? "REFUNDED" : "REFUND_PENDING", refundId: refund.id, refundedAmount: payment.amount },
    });
    await db.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: refund.status === "processed" ? "REFUNDED" : "REFUND_PENDING",
        events: { create: { message: "Refund initiated to the original payment method. It usually reflects in 5–7 working days." } },
      },
    });
  } catch (err) {
    console.error(`[payments] refund failed for order ${orderId}`, err);
    await db.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "REFUND_PENDING",
        events: { create: { isPublic: false, message: `Automatic refund failed — process manually in Razorpay. ${(err as Error).message}` } },
      },
    });
  }
}

export async function cancelOrder(
  orderId: string,
  opts: { reason: string; actor: SessionUser | null; byCustomer?: boolean; notifyCustomer?: boolean },
) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderError("Order not found.");
  if (opts.byCustomer && order.userId !== opts.actor?.id) throw new OrderError("Order not found.");
  const allowed = opts.byCustomer ? CUSTOMER_CANCELLABLE : ADMIN_CANCELLABLE;
  if (!allowed.includes(order.status)) throw new OrderError("This order can no longer be cancelled.");

  const productIds = await db.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: opts.reason.slice(0, 500), paymentExpiresAt: null },
    });
    if (claim.count !== 1) throw new OrderError("The order was updated by someone else. Please refresh.");
    const ids = await restock(tx, orderId, `Order cancelled: ${opts.reason}`.slice(0, 190), opts.actor?.role === "ADMIN" ? opts.actor.id : null);
    await releaseCoupon(tx, orderId);
    await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "FAILED", failureReason: "Order cancelled" } });
    await tx.orderEvent.create({
      data: {
        orderId,
        status: "CANCELLED",
        message: opts.byCustomer ? `Cancelled by you: ${opts.reason}` : `Order cancelled: ${opts.reason}`,
        actorId: opts.actor?.id ?? null,
      },
    });
    if (order.paymentStatus === "PENDING") {
      await tx.order.update({ where: { id: orderId }, data: { paymentStatus: order.paymentMethod === "COD" ? "PENDING" : "FAILED" } });
    }
    await refreshProductAggregates(ids, tx);
    return ids;
  });

  if (order.paymentStatus === "PAID" && order.paymentMethod === "RAZORPAY") await refundOrderPayment(orderId, opts.reason);
  if (opts.notifyCustomer !== false && order.status !== "PENDING_PAYMENT") void sendOrderEmail(orderId, "cancelled");
  return productIds;
}

/** Releases stock held by unpaid online orders past their payment window. Run from cron. */
export async function expireUnpaidOrders(): Promise<number> {
  const stale = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", paymentExpiresAt: { lt: new Date() } },
    select: { id: true, payments: { where: { provider: "RAZORPAY" }, select: { providerOrderId: true } } },
    take: 200,
  });
  let n = 0;
  for (const o of stale) {
    try {
      await cancelOrder(o.id, { reason: "Payment not completed in time", actor: null, notifyCustomer: false });
      n++;
    } catch (err) {
      console.error(`[orders] failed to expire ${o.id}`, err);
    }
  }
  return n;
}

async function nextInvoiceNumber(tx: Tx, prefix: string): Promise<string> {
  const fy = financialYear();
  const counter = await tx.counter.upsert({
    where: { key: `invoice:${fy}` },
    update: { value: { increment: 1 } },
    create: { key: `invoice:${fy}`, value: 1 },
  });
  return formatInvoiceNumber(prefix, fy, counter.value);
}

export async function advanceOrderStatus(
  orderId: string,
  to: OrderStatus,
  actor: SessionUser,
  details: { courierName?: string; trackingNumber?: string; trackingUrl?: string; note?: string } = {},
) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderError("Order not found.");
  if (!canTransition(order.status, to)) throw new OrderError(`Cannot move an order from ${order.status} to ${to}.`);
  if (to === "SHIPPED" && (!details.courierName || !details.trackingNumber))
    throw new OrderError("Courier name and tracking number are required to mark an order shipped.");

  const settings = await getSettings();
  const now = new Date();
  await db.$transaction(async (tx) => {
    const data: Prisma.OrderUpdateInput = { status: to };
    if (to === "SHIPPED") {
      data.shippedAt = now;
      data.courierName = details.courierName;
      data.trackingNumber = details.trackingNumber;
      data.trackingUrl = details.trackingUrl || null;
      // Tax invoice is issued at the time of removal of goods (dispatch).
      if (!order.invoiceNumber) {
        data.invoiceNumber = await nextInvoiceNumber(tx, settings.invoicePrefix);
        data.invoicedAt = now;
      }
    }
    if (to === "DELIVERED") {
      data.deliveredAt = now;
      if (order.paymentMethod === "COD") data.paymentStatus = "PAID";
    }
    if (to === "RETURNED") {
      data.paymentStatus = order.paymentStatus === "PAID" ? "REFUND_PENDING" : order.paymentStatus;
    }
    const claim = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: to } });
    if (claim.count !== 1) throw new OrderError("The order was updated by someone else. Please refresh.");
    await tx.order.update({ where: { id: orderId }, data });
    if (to === "DELIVERED" && order.paymentMethod === "COD") {
      await tx.payment.updateMany({ where: { orderId, provider: "COD" }, data: { status: "PAID" } });
    }
    if (to === "RETURNED") {
      const ids = await restock(tx, orderId, "Returned to stock", actor.id);
      await refreshProductAggregates(ids, tx);
    }
    const messages: Partial<Record<OrderStatus, string>> = {
      PACKED: "Your order has been packed and will be handed to the courier soon.",
      SHIPPED: `Shipped with ${details.courierName} (tracking ${details.trackingNumber}).`,
      OUT_FOR_DELIVERY: "Your order is out for delivery today.",
      DELIVERED: "Delivered. Enjoy your purchase!",
      RETURNED: "Return received and inspected.",
    };
    await tx.orderEvent.create({ data: { orderId, status: to, message: messages[to] ?? to, actorId: actor.id } });
    if (details.note) await tx.orderEvent.create({ data: { orderId, message: details.note, isPublic: false, actorId: actor.id } });
  });

  if (to === "RETURNED" && order.paymentMethod === "RAZORPAY" && order.paymentStatus === "PAID") {
    await refundOrderPayment(orderId, "Order returned");
  }
  if (to === "SHIPPED" || to === "OUT_FOR_DELIVERY" || to === "DELIVERED") void sendOrderEmail(orderId, to === "SHIPPED" ? "shipped" : to === "DELIVERED" ? "delivered" : "out_for_delivery");
}

export async function requestReturn(orderId: string, user: SessionUser, reason: string) {
  const order = await db.order.findFirst({ where: { id: orderId, userId: user.id }, include: { items: { include: { product: { select: { returnWindowDays: true } } } } } });
  if (!order) throw new OrderError("Order not found.");
  if (order.status !== "DELIVERED") throw new OrderError("Only delivered orders can be returned.");
  const windowDays = Math.max(0, ...order.items.map((i) => i.product?.returnWindowDays ?? 0));
  if (!order.deliveredAt || Date.now() > order.deliveredAt.getTime() + windowDays * 86400_000)
    throw new OrderError("The return window for this order has closed.");
  const claim = await db.order.updateMany({
    where: { id: orderId, status: "DELIVERED" },
    data: { status: "RETURN_REQUESTED", returnReason: reason.slice(0, 500) },
  });
  if (claim.count !== 1) throw new OrderError("Could not request a return. Please refresh.");
  await db.orderEvent.create({ data: { orderId, status: "RETURN_REQUESTED", message: `Return requested: ${reason}`, actorId: user.id } });
}

/** Marks a manual refund (e.g. COD return refunded by bank transfer) as complete. */
export async function markRefunded(orderId: string, actor: SessionUser, note: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentStatus !== "REFUND_PENDING") throw new OrderError("No refund is pending for this order.");
  await db.order.update({
    where: { id: orderId },
    data: { paymentStatus: "REFUNDED", events: { create: { message: `Refund completed. ${note}`.trim(), actorId: actor.id } } },
  });
  await db.payment.updateMany({ where: { orderId, status: { in: ["PAID", "REFUND_PENDING"] } }, data: { status: "REFUNDED" } });
}
