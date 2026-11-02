/**
 * Guest payment route for the rosa-cvetov web shop.
 *
 * Mirrors the messenger-authed `POST /api/payment/create` (see
 * `src/routes/payment.ts`) but without the user ownership check, since
 * web visitors have no platform identity. The protection here is:
 *
 *   - Order must exist
 *   - Order must belong to a "guest" user (telegramId/maxId both null)
 *   - The caller must present the order's `guestToken`, which only the
 *     browser that created the order received
 *   - Order must not be paid or canceled
 *   - Order must be < 24h old
 *
 * A repeat call returns the same payment link while it can still be paid.
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
import { safeReturnUrl } from '../services/yukassa';
import { getOrCreatePayment, PaymentConflict } from '../services/payments';

const router = Router();

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SITE_URL = process.env.SITE_URL || 'https://rosa-web.vercel.app';

router.post('/create-guest', async (req: Request, res: Response) => {
  try {
    const { orderId, returnUrl, token } = req.body as { orderId?: number; returnUrl?: string; token?: string };

    if (!orderId || !Number.isInteger(orderId)) {
      res.status(400).json({ error: 'Некорректный номер заказа' });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: { select: { telegramId: true, maxId: true } } },
    });

    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    if (order.user.telegramId || order.user.maxId) {
      res.status(403).json({ error: 'This endpoint is for guest orders only' });
      return;
    }

    if (!order.guestToken || order.guestToken !== token) {
      res.status(403).json({ error: 'Нет доступа к этому заказу' });
      return;
    }

    if (order.paymentStatus === 'paid') {
      res.status(409).json({ error: 'Заказ уже оплачен' });
      return;
    }
    if (order.status === 'canceled') {
      res.status(409).json({ error: 'Заказ отменён' });
      return;
    }

    if (Date.now() - order.createdAt.getTime() > MAX_AGE_MS) {
      res.status(410).json({ error: 'Срок оплаты заказа истёк. Оформите заказ заново.' });
      return;
    }

    const payment = await getOrCreatePayment(
      order,
      safeReturnUrl(returnUrl) || `${SITE_URL}/thank-you?orderId=${order.id}`,
    );

    res.json({ confirmationUrl: payment.confirmationUrl, paymentId: payment.id });
  } catch (error) {
    if (error instanceof PaymentConflict) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Guest payment error:', error);
    res.status(500).json({ error: 'Не удалось создать платёж. Попробуйте ещё раз или позвоните нам.' });
  }
});

export const guestPaymentRoutes = router;
