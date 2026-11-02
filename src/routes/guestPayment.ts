/**
 * Guest payment route for the rosa-cvetov web shop.
 *
 * Mirrors the messenger-authed `POST /api/payment/create` (see
 * `src/routes/payment.ts`) but without the user ownership check, since
 * web visitors have no platform identity. The protection here is:
 *
 *   - Order must exist
 *   - Order must belong to a "guest" user (telegramId/maxId both null)
 *   - Order must be in `paymentStatus = 'pending'`
 *   - Order must not have a paymentId yet
 *   - Order must be < 24h old (cheap rate-limit against orderId-guessing)
 *
 * The webhook (`POST /api/payment/webhook`) already handles paid-state
 * transitions correctly for guest orders — `notifyPaymentSuccess` skips
 * its Telegram/Max blocks when both platform IDs are null, but
 * `notifyAdminPayment` still fires.
 *
 * Mount in src/index.ts (next to the existing payment route):
 *
 *   import { guestPaymentRoutes } from './routes/guestPayment';
 *   app.use('/api/payment', guestPaymentRoutes); // adds POST /api/payment/create-guest
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { createPayment } from '../services/yukassa';

const router = Router();

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

router.post('/create-guest', async (req: Request, res: Response) => {
  try {
    const { orderId, returnUrl } = req.body as { orderId?: number; returnUrl?: string };

    if (!orderId || !Number.isFinite(orderId)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: { select: { telegramId: true, maxId: true } } },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (order.user.telegramId || order.user.maxId) {
      res.status(403).json({ error: 'This endpoint is for guest orders only' });
      return;
    }

    if (order.paymentStatus !== 'pending') {
      res.status(409).json({ error: `Order already ${order.paymentStatus}` });
      return;
    }
    if (order.paymentId) {
      res.status(409).json({ error: 'Payment already initialized for this order' });
      return;
    }

    if (Date.now() - order.createdAt.getTime() > MAX_AGE_MS) {
      res.status(410).json({ error: 'Order expired' });
      return;
    }

    /* ---- Receipt items, mirroring the authed flow ---- */
    const originalItemsTotal = order.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const promoDiscount = order.promoDiscount || 0;

    const paymentItems = order.items.map((item) => {
      let price = item.price;
      if (promoDiscount > 0 && originalItemsTotal > 0) {
        price = Math.round(item.price * (1 - promoDiscount / originalItemsTotal));
      }
      return { name: item.name, price, quantity: item.quantity };
    });

    const discountedItemsTotal = paymentItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const deliveryCost = order.totalPrice - discountedItemsTotal;
    if (deliveryCost > 0) {
      paymentItems.push({ name: 'Доставка', price: deliveryCost, quantity: 1 });
    }

    /* ---- Create YuKassa payment ---- */
    const payment = await createPayment(
      order.totalPrice,
      order.id,
      `Заказ #${order.id} — Роза цветов`,
      paymentItems,
      undefined,
      returnUrl,
    );

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentId: payment.id },
    });

    res.json({ confirmationUrl: payment.confirmationUrl, paymentId: payment.id });
  } catch (error) {
    console.error('Guest payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

export const guestPaymentRoutes = router;
