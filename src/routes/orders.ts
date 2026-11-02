import { Router, Response } from 'express';
import { prisma } from '../index';
import { messengerAuth, MessengerAuthenticatedRequest } from '../middleware/messengerAuth';
import { notifyOrderCreated } from '../notifications';
import { applyPromo, assertMinOrder, cleanDeliveryDate, cleanText, getOrderSettings, OrderError, priceItems } from '../services/orderPricing';
import { cancelOrderWithRefund } from '../services/loyalty';
import { syncOrderPayment } from '../services/payments';

const router = Router();

// Helper: find user by platform
async function findUserByPlatform(platform: string, platformId: string) {
  if (platform === 'telegram') {
    return prisma.user.findUnique({ where: { telegramId: platformId } });
  }
  return prisma.user.findUnique({ where: { maxId: platformId } });
}

// GET /api/orders — мои заказы
router.get('/', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const user = await findUserByPlatform(mu.platform, mu.platformId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const pending = await prisma.order.findMany({
      where: { userId: user.id, paymentStatus: 'pending', paymentId: { not: null } },
      select: { id: true, paymentId: true, paymentStatus: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    await Promise.all(pending.map(syncOrderPayment));

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: { items: true, address: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// POST /api/orders — создать заказ
router.post('/', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const user = await findUserByPlatform(mu.platform, mu.platformId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const {
      items,
      addressId,
      deliveryType,
      deliveryDate,
      deliveryTime,
      recipientName,
      recipientPhone,
      comment,
      bonusUsed,
      isAnonymous,
      cardText,
      promoCode,
    } = req.body;

    const type = deliveryType || 'delivery';
    if (!['delivery', 'pickup'].includes(type)) {
      throw new OrderError('Некорректный способ получения');
    }

    const recipient = cleanText(recipientName, 100);
    if (!recipient) {
      throw new OrderError('Укажите имя получателя');
    }
    const phone = cleanText(recipientPhone, 32);
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      throw new OrderError('Укажите телефон получателя, минимум 10 цифр');
    }

    // A delivery needs an address, and only the customer's own address can be used
    let orderAddressId: number | null = null;
    if (type === 'delivery') {
      if (!Number.isInteger(addressId)) {
        throw new OrderError('Укажите адрес доставки');
      }
      const address = await prisma.address.findUnique({ where: { id: addressId } });
      if (!address || address.userId !== user.id || address.deletedAt) {
        throw new OrderError('Адрес доставки не найден. Укажите его заново.');
      }
      orderAddressId = address.id;
    }

    const date = cleanDeliveryDate(deliveryDate);
    const { lines, subtotal: productSubtotal } = await priceItems(items);
    const settings = await getOrderSettings();
    assertMinOrder(productSubtotal, settings.minOrder);

    const promo = await applyPromo(promoCode, productSubtotal, { id: user.id });
    let totalPrice = productSubtotal - promo.promoDiscount;

    // Validate bonus usage
    let actualBonusUsed = 0;
    const requestedBonus = Math.floor(Number(bonusUsed));
    if (requestedBonus > 0) {
      const maxBonus = Math.min(Math.floor((totalPrice * settings.maxBonusPercent) / 100), totalPrice - 1);
      actualBonusUsed = Math.max(0, Math.min(requestedBonus, user.bonusPoints, maxBonus));
      totalPrice -= actualBonusUsed;
    }

    // Delivery cost
    if (type === 'delivery' && productSubtotal < settings.freeDeliveryFrom) {
      totalPrice += settings.deliveryPrice;
    }

    // Calculate bonus earned on product subtotal (before delivery and discount)
    const bonusEarned = Math.floor((productSubtotal * settings.bonusPercent) / 100);

    // Fix 1.5: Wrap order creation + bonus spend in transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: user.id,
          addressId: orderAddressId,
          deliveryType: type,
          deliveryDate: date,
          deliveryTime: cleanText(deliveryTime, 32),
          recipientName: recipient,
          recipientPhone: phone,
          comment: cleanText(comment, 1000),
          totalPrice,
          bonusUsed: actualBonusUsed,
          bonusEarned,
          promoCode: promo.promoCode,
          promoDiscount: promo.promoDiscount,
          isAnonymous: isAnonymous === true,
          cardText: cleanText(cardText, 1000),
          items: { create: lines },
        },
        include: { items: true },
      });

      if (actualBonusUsed > 0) {
        // The guarded update keeps the balance from going negative under concurrent orders
        const spent = await tx.user.updateMany({
          where: { id: user.id, bonusPoints: { gte: actualBonusUsed } },
          data: { bonusPoints: { decrement: actualBonusUsed } },
        });
        if (spent.count === 0) {
          throw new OrderError('Бонусов уже недостаточно. Проверьте сумму и попробуйте ещё раз.', 409);
        }
        await tx.loyaltyHistory.create({
          data: {
            userId: user.id,
            amount: -actualBonusUsed,
            type: 'spend',
            description: `Списание за заказ #${newOrder.id}`,
            orderId: newOrder.id,
          },
        });
      }

      return newOrder;
    });

    // Notify client about successful order (via correct platform)
    try {
      await notifyOrderCreated(
        user.id,
        order.id,
        totalPrice,
        lines.length,
        type,
        bonusEarned,
      );
    } catch (e) {
      console.error('Failed to notify client about order:', e);
    }

    // Admin notification moved to payment webhook — admins are notified only after successful payment

    // Fix 1.7: Return 201 for created order
    res.status(201).json(order);
  } catch (error) {
    if (error instanceof OrderError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Не удалось создать заказ. Попробуйте ещё раз или позвоните нам.' });
  }
});

// POST /api/orders/:id/cancel — клиент отменяет неоплаченный заказ
router.post('/:id/cancel', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const user = await findUserByPlatform(mu.platform, mu.platformId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid order ID' }); return; }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    if (order.userId !== user.id) { res.status(403).json({ error: 'Access denied' }); return; }

    await syncOrderPayment(order);
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id } });
    if (fresh.paymentStatus === 'paid' || fresh.status !== 'new') {
      res.status(409).json({ error: 'Этот заказ уже нельзя отменить. Позвоните нам, мы поможем.' });
      return;
    }

    await cancelOrderWithRefund(id);
    res.json(await prisma.order.findUnique({ where: { id }, include: { items: true, address: true } }));
  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(500).json({ error: 'Не удалось отменить заказ. Попробуйте ещё раз или позвоните нам.' });
  }
});

// GET /api/orders/:id — один заказ
// Fix 1.6: IDOR fix — add ownership check
router.get('/:id', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const user = await findUserByPlatform(mu.platform, mu.platformId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid order ID' }); return; }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, address: true },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    if (order.userId !== user.id) { res.status(403).json({ error: 'Access denied' }); return; }

    await syncOrderPayment(order);

    res.json(await prisma.order.findUnique({ where: { id }, include: { items: true, address: true } }));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

export { router as orderRoutes };
