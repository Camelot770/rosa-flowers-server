import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { telegramAuth, AuthenticatedRequest } from '../middleware/telegramAuth';
import { createPayment, handleWebhook } from '../services/yukassa';
import { earnBonus } from '../services/loyalty';

const router = Router();

// POST /api/payment/create — создать платёж
router.post('/create', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

    const payment = await createPayment(order.totalPrice, orderId, `Заказ #${orderId} — Роза цветов`);

    await prisma.order.update({
      where: { id: orderId },
      data: { paymentId: payment.id },
    });

    res.json({ confirmationUrl: payment.confirmationUrl, paymentId: payment.id });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// POST /api/payment/webhook — ЮKassa webhook
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = body.event;
    const paymentData = body.object;

    if (event === 'payment.succeeded') {
      const orderId = parseInt(paymentData.metadata?.orderId);
      if (orderId) {
        const order = await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'paid',
            status: 'confirmed',
          },
        });

        // Earn bonus
        if (order.bonusEarned > 0) {
          await earnBonus(order.userId, order.bonusEarned, order.id);
        }
      }
    }

    if (event === 'payment.canceled') {
      const orderId = parseInt(paymentData.metadata?.orderId);
      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'canceled' },
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ success: true }); // Always respond 200 to webhook
  }
});

export { router as paymentRoutes };
