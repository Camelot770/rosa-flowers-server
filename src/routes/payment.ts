import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { messengerAuth, MessengerAuthenticatedRequest } from '../middleware/messengerAuth';
import { createPayment } from '../services/yukassa';
import { notifyPaymentSuccess, notifyAdminPayment } from '../notifications';

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

    const { orderId } = req.body;
    if (!orderId || isNaN(orderId)) { res.status(400).json({ error: 'Invalid order ID' }); return; }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    if (order.userId !== user.id) { res.status(403).json({ error: 'Access denied' }); return; }

    // Формируем позиции для чека
    const paymentItems = order.items.map((item) => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    // Если есть доставка — добавляем как отдельную позицию
    const itemsTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryCost = order.totalPrice - itemsTotal + (order.bonusUsed || 0);
    if (deliveryCost > 0) {
      paymentItems.push({
        name: 'Доставка',
        price: deliveryCost,
        quantity: 1,
      });
    }

    const payment = await createPayment(
      order.totalPrice,
      orderId,
      `Заказ #${orderId} — Роза цветов`,
      paymentItems,
    );

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

    // Fix 2.3: Wrap bonus earn in transaction + idempotency check
    if (event === 'payment.succeeded') {
      // Idempotency: skip if already paid (YuKassa may retry webhooks)
      const existingOrder = await prisma.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true } });
      if (existingOrder?.paymentStatus === 'paid') {
        res.json({ success: true });
        return;
      }

      const order = await prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'paid', status: 'confirmed' },
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

      // Load full order details for notification
      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          items: true,
          address: true,
        },
      });

      // Notify client about successful payment (dispatches to correct platform)
      try {
        const items = fullOrder?.items || [];
        const address = fullOrder?.address;
        await notifyPaymentSuccess(
          order.userId,
          order.id,
          order.totalPrice,
          order.bonusEarned,
          items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
          order.deliveryType,
          order.deliveryDate || undefined,
          order.deliveryTime || undefined,
          address ? `${address.street}, ${address.house}${address.apartment ? ', кв. ' + address.apartment : ''}` : undefined,
          order.recipientName || undefined,
        );
      } catch (e) {
        console.error('Failed to notify client about payment:', e);
      }

      // Notify admin about payment with full order details
      try {
        const items = fullOrder?.items || [];
        const address = fullOrder?.address;
        // Determine platform from user
        const orderUser = await prisma.user.findUnique({
          where: { id: order.userId },
          select: { telegramId: true, maxId: true, firstName: true, lastName: true },
        });
        const platform = orderUser?.maxId && !orderUser?.telegramId ? 'max' : 'telegram';
        const customerName = orderUser ? `${orderUser.firstName || ''}${orderUser.lastName ? ' ' + orderUser.lastName : ''}`.trim() || 'Клиент' : 'Клиент';

        await notifyAdminPayment(
          order.id,
          order.totalPrice,
          items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
          order.deliveryType || undefined,
          order.deliveryDate || undefined,
          order.deliveryTime || undefined,
          address ? `${address.street}, ${address.house}${address.apartment ? ', кв. ' + address.apartment : ''}` : undefined,
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
