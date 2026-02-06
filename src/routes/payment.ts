import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { telegramAuth, AuthenticatedRequest } from '../middleware/telegramAuth';
import { createPayment } from '../services/yukassa';
import { notifyPaymentSuccess, notifyAdminPayment } from '../bot';

const router = Router();

// POST /api/payment/create — создать платёж
// Fix 2.1: Ownership check on payment creation
router.post('/create', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tgUser = req.telegramUser!;
    const user = await prisma.user.findUnique({ where: { telegramId: String(tgUser.id) } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const { orderId } = req.body;
    if (!orderId || isNaN(orderId)) { res.status(400).json({ error: 'Invalid order ID' }); return; }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    if (order.userId !== user.id) { res.status(403).json({ error: 'Access denied' }); return; }

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
// TODO: Add YuKassa IP allowlist or signature verification for production security
// Fix 2.2: Safer body parsing + Fix 2.3: Transaction for bonus earn
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Parse body (may be raw Buffer from express.raw middleware)
    let body: any;
    if (Buffer.isBuffer(req.body)) {
      body = JSON.parse(req.body.toString('utf-8'));
    } else if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = req.body;
    }

    const event = body.event;
    const paymentData = body.object;

    if (!paymentData?.metadata?.orderId) {
      res.json({ success: true });
      return;
    }

    const orderId = parseInt(String(paymentData.metadata.orderId));
    if (isNaN(orderId)) {
      res.json({ success: true });
      return;
    }

    // Fix 2.3: Wrap bonus earn in transaction
    if (event === 'payment.succeeded') {
      const order = await prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'paid', status: 'confirmed' },
          include: { user: { select: { telegramId: true } } },
        });

        if (updatedOrder.bonusEarned > 0) {
          await tx.user.update({
            where: { id: updatedOrder.userId },
            data: { bonusPoints: { increment: updatedOrder.bonusEarned } },
          });
          await tx.loyaltyHistory.create({
            data: {
              userId: updatedOrder.userId,
              amount: updatedOrder.bonusEarned,
              type: 'earn',
              description: `Кэшбэк за заказ #${updatedOrder.id}`,
              orderId: updatedOrder.id,
            },
          });
        }

        return updatedOrder;
      });

      // Notify client about successful payment
      try {
        await notifyPaymentSuccess(
          order.user.telegramId,
          order.id,
          order.totalPrice,
          order.bonusEarned,
        );
      } catch (e) {
        console.error('Failed to notify client about payment:', e);
      }

      // Notify admin about payment
      try {
        await notifyAdminPayment(order.id, order.totalPrice);
      } catch (e) {
        console.error('Failed to notify admin about payment:', e);
      }
    }

    if (event === 'payment.canceled') {
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'canceled' },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ success: true }); // Always respond 200 to webhook
  }
});

export { router as paymentRoutes };
