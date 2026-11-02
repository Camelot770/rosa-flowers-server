import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { createPayment, fetchPayment, PaymentResult, YooKassaPayment } from './yukassa';
import { buildReceiptItems } from './receipt';
import { notifyPaymentSuccess, notifyAdminPayment, notifyAdminAlert } from '../notifications';

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

export class PaymentConflict extends Error {}

// Returns the link of a payment that can still be paid, or creates a new payment
export async function getOrCreatePayment(order: OrderWithItems, returnUrl?: string): Promise<PaymentResult> {
  if (order.paymentId) {
    const current = await fetchPayment(order.paymentId);
    if (current?.status === 'succeeded') {
      await applyPaymentState(current);
      throw new PaymentConflict('Заказ уже оплачен');
    }
    if (current?.status === 'pending' && current.confirmation?.confirmation_url) {
      return { id: current.id, confirmationUrl: current.confirmation.confirmation_url };
    }
  }

  const payment = await createPayment(
    order.totalPrice,
    order.id,
    `Заказ #${order.id} — Роза цветов`,
    buildReceiptItems(order),
    order.customerEmail || undefined,
    returnUrl,
    order.paymentId || undefined,
  );

  await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: { not: 'paid' } },
    data: { paymentId: payment.id, paymentStatus: 'pending' },
  });

  return payment;
}

// Applies a payment state read from the YooKassa API. Never pass webhook body data here.
export async function applyPaymentState(payment: YooKassaPayment): Promise<void> {
  const orderId = parseInt(String(payment.metadata?.orderId));
  if (isNaN(orderId)) return;

  if (payment.status === 'succeeded') {
    await markPaid(orderId, payment);
  } else if (payment.status === 'canceled') {
    // A stale payment of an order that already has a newer one must not touch the order
    await prisma.order.updateMany({
      where: { id: orderId, paymentId: payment.id, paymentStatus: 'pending' },
      data: { paymentStatus: 'canceled' },
    });
  }
}

async function markPaid(orderId: number, payment: YooKassaPayment): Promise<void> {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { totalPrice: true, paymentId: true, paymentStatus: true },
  });
  if (!existing) {
    console.error(`Payment ${payment.id} refers to unknown order ${orderId}`);
    return;
  }

  const paidKop = Math.round(parseFloat(payment.amount.value) * 100);
  if (payment.amount.currency !== 'RUB' || paidKop !== existing.totalPrice * 100) {
    console.error(`Payment ${payment.id} amount ${payment.amount.value} differs from order ${orderId} total ${existing.totalPrice}`);
    await notifyAdminAlert(`⚠️ Сумма оплаты ${payment.amount.value} ₽ не совпадает с заказом #${orderId} (${existing.totalPrice} ₽). Проверьте платёж в кабинете ЮKassa.`);
    return;
  }

  if (existing.paymentStatus === 'paid' && existing.paymentId !== payment.id) {
    await notifyAdminAlert(`⚠️ Заказ #${orderId} оплачен повторно на ${existing.totalPrice} ₽. Верните лишний платёж в кабинете ЮKassa.`);
    return;
  }

  // The guarded update makes repeated and concurrent notifications credit bonuses only once
  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: { not: 'paid' } },
      data: { paymentStatus: 'paid', paymentId: payment.id },
    });
    if (updated.count === 0) return null;

    await tx.order.updateMany({
      where: { id: orderId, status: 'new' },
      data: { status: 'confirmed' },
    });

    const paidOrder = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

    if (paidOrder.status !== 'canceled' && paidOrder.bonusEarned > 0) {
      await tx.user.update({
        where: { id: paidOrder.userId },
        data: { bonusPoints: { increment: paidOrder.bonusEarned } },
      });
      await tx.loyaltyHistory.create({
        data: {
          userId: paidOrder.userId,
          amount: paidOrder.bonusEarned,
          type: 'earn',
          description: `Кэшбэк за заказ #${paidOrder.id}`,
          orderId: paidOrder.id,
        },
      });
    }

    return paidOrder;
  });
  if (!order) return;

  if (order.status === 'canceled') {
    await notifyAdminAlert(`⚠️ Пришла оплата ${order.totalPrice} ₽ по отменённому заказу #${order.id}. Верните деньги в кабинете ЮKassa или восстановите заказ.`);
    return;
  }

  await notifyPaid(order.id);
}

async function notifyPaid(orderId: number): Promise<void> {
  // Load full order details for notification
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      address: true,
      user: { select: { telegramId: true, maxId: true, firstName: true, lastName: true } },
    },
  });
  if (!order) return;

  const items = order.items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity }));
  const a = order.address;
  // Site orders keep the city in the title: "Казань, Баумана"
  const address = a
    ? `${a.title.endsWith(`, ${a.street}`) ? a.title : a.street}, ${a.house}${a.apartment ? ', кв. ' + a.apartment : ''}`
    : undefined;

  // Notify client about successful payment (dispatches to correct platform)
  try {
    await notifyPaymentSuccess(
      order.userId,
      order.id,
      order.totalPrice,
      order.bonusEarned,
      items,
      order.deliveryType,
      order.deliveryDate || undefined,
      order.deliveryTime || undefined,
      address,
      order.recipientName || undefined,
    );
  } catch (e) {
    console.error('Failed to notify client about payment:', e);
  }

  // Notify admin about payment with full order details
  try {
    const { telegramId, maxId, firstName, lastName } = order.user;
    const platform = telegramId ? 'telegram' : maxId ? 'max' : 'web';
    const customerName = `${firstName || ''}${lastName ? ' ' + lastName : ''}`.trim() || 'Клиент';

    await notifyAdminPayment(
      order.id,
      order.totalPrice,
      items,
      order.deliveryType || undefined,
      order.deliveryDate || undefined,
      order.deliveryTime || undefined,
      address,
      order.recipientName || undefined,
      customerName,
      platform,
      order.bonusEarned,
      order.recipientPhone || undefined,
      order.bonusUsed,
    );
  } catch (e) {
    console.error('Failed to notify admin about payment:', e);
  }
}

const SYNC_INTERVAL_MS = 15000;
const SYNC_TIMEOUT_MS = 5000;
const lastSync = new Map<number, number>();

// Picks up a payment result even when the webhook did not arrive
export async function syncOrderPayment(order: { id: number; paymentId: string | null; paymentStatus: string }): Promise<void> {
  if (!order.paymentId || order.paymentStatus !== 'pending') return;

  const now = Date.now();
  if (now - (lastSync.get(order.id) || 0) < SYNC_INTERVAL_MS) return;
  if (lastSync.size > 5000) lastSync.clear();
  lastSync.set(order.id, now);

  try {
    const payment = await fetchPayment(order.paymentId, SYNC_TIMEOUT_MS);
    if (payment) await applyPaymentState(payment);
  } catch (e) {
    console.error(`Failed to sync payment of order ${order.id}:`, e);
  }
}
