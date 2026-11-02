import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { messengerAuth, MessengerAuthenticatedRequest } from '../middleware/messengerAuth';
import { fetchPayment, safeReturnUrl } from '../services/yukassa';
import { applyPaymentState, getOrCreatePayment, PaymentConflict } from '../services/payments';

const router = Router();

// Helper: find user by platform
async function findUserByPlatform(platform: string, platformId: string) {
  if (platform === 'telegram') {
    return prisma.user.findUnique({ where: { telegramId: platformId } });
  }
  return prisma.user.findUnique({ where: { maxId: platformId } });
}

// POST /api/payment/create — создать платёж
// Fix 2.1: Ownership check on payment creation
router.post('/create', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const user = await findUserByPlatform(mu.platform, mu.platformId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const orderId = Number(req.body.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) { res.status(400).json({ error: 'Invalid order ID' }); return; }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    if (order.userId !== user.id) { res.status(403).json({ error: 'Access denied' }); return; }
    if (order.paymentStatus === 'paid') { res.status(409).json({ error: 'Заказ уже оплачен' }); return; }
    if (order.status === 'canceled') { res.status(409).json({ error: 'Заказ отменён' }); return; }

    const payment = await getOrCreatePayment(order, safeReturnUrl(req.body.returnUrl));

    res.json({ confirmationUrl: payment.confirmationUrl, paymentId: payment.id });
  } catch (error) {
    if (error instanceof PaymentConflict) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Payment error:', error);
    res.status(500).json({ error: 'Не удалось создать платёж. Попробуйте ещё раз или позвоните нам.' });
  }
});

// POST /api/payment/webhook — ЮKassa webhook
// The body is only a hint which payment changed: its state is always re-read from the YooKassa API,
// so a forged request cannot mark an order as paid.
router.post('/webhook', async (req: Request, res: Response) => {
  let body: any;
  try {
    // Parse body (may be raw Buffer from express.raw middleware)
    if (Buffer.isBuffer(req.body)) {
      body = JSON.parse(req.body.toString('utf-8'));
    } else if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = req.body;
    }
  } catch {
    res.json({ success: true });
    return;
  }

  const paymentId = body?.object?.id;
  if (typeof paymentId !== 'string' || !['payment.succeeded', 'payment.canceled'].includes(body?.event)) {
    res.json({ success: true });
    return;
  }

  try {
    const payment = await fetchPayment(paymentId);
    if (!payment) {
      console.warn(`Webhook for a payment unknown to YooKassa: ${paymentId}`);
      res.json({ success: true });
      return;
    }

    await applyPaymentState(payment);
    res.json({ success: true });
  } catch (error) {
    // A non-200 answer makes YooKassa repeat the notification later
    console.error('Webhook error:', error);
    res.status(500).json({ success: false });
  }
});

export { router as paymentRoutes };
