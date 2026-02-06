import { Router, Response } from 'express';
import { prisma } from '../index';
import { telegramAuth, AuthenticatedRequest } from '../middleware/telegramAuth';
import { notifyOrderCreated, notifyAdminNewOrder } from '../bot';

const router = Router();

// GET /api/orders — мои заказы
router.get('/', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tgUser = req.telegramUser!;
    const user = await prisma.user.findUnique({ where: { telegramId: String(tgUser.id) } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

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
router.post('/', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tgUser = req.telegramUser!;
    const user = await prisma.user.findUnique({ where: { telegramId: String(tgUser.id) } });
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
    } = req.body;

    // Fix 1.2: Input validation
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Order must contain at least one item' });
      return;
    }
    if (deliveryType && !['delivery', 'pickup'].includes(deliveryType)) {
      res.status(400).json({ error: 'Invalid delivery type' });
      return;
    }
    for (const item of items) {
      if (!item.name || !item.quantity || item.quantity <= 0) {
        res.status(400).json({ error: 'Invalid item data' });
        return;
      }
    }

    // Fix 1.1 + 1.3: Server-side price validation from DB
    let totalPrice = 0;
    for (const item of items) {
      if (item.bouquetId && !item.isConstructor) {
        const bouquet = await prisma.bouquet.findUnique({ where: { id: item.bouquetId } });
        if (!bouquet) {
          res.status(400).json({ error: `Bouquet not found: ${item.bouquetId}` });
          return;
        }
        totalPrice += bouquet.price * item.quantity;
        item.price = bouquet.price; // override with DB price
      } else {
        totalPrice += item.price * item.quantity;
      }
    }

    // Fix 1.4: Save product subtotal BEFORE bonus and delivery modifications
    const productSubtotal = totalPrice;

    // Validate bonus usage
    let actualBonusUsed = 0;
    if (bonusUsed && bonusUsed > 0) {
      const maxBonus = Math.floor(totalPrice * 0.2); // max 20% discount
      actualBonusUsed = Math.min(bonusUsed, user.bonusPoints, maxBonus);
      totalPrice -= actualBonusUsed;
    }

    // Delivery cost
    const settings = await prisma.setting.findMany({
      where: { key: { in: ['delivery_price', 'free_delivery_from'] } },
    });
    const deliveryPrice = parseInt(settings.find((s) => s.key === 'delivery_price')?.value || '300');
    const freeFrom = parseInt(settings.find((s) => s.key === 'free_delivery_from')?.value || '3000');

    if (deliveryType === 'delivery' && totalPrice < freeFrom) {
      totalPrice += deliveryPrice;
    }

    // Calculate bonus earned on product subtotal (before delivery and discount)
    const bonusPercent = parseInt(
      (await prisma.setting.findUnique({ where: { key: 'bonus_percent' } }))?.value || '5'
    );
    const bonusEarned = Math.floor((productSubtotal * bonusPercent) / 100);

    // Fix 1.5: Wrap order creation + bonus spend in transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: user.id,
          addressId: addressId || null,
          deliveryType: deliveryType || 'delivery',
          deliveryDate,
          deliveryTime,
          recipientName,
          recipientPhone,
          comment,
          totalPrice,
          bonusUsed: actualBonusUsed,
          bonusEarned,
          isAnonymous: isAnonymous || false,
          cardText,
          items: {
            create: items.map((item: any) => ({
              bouquetId: item.bouquetId || null,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              isConstructor: item.isConstructor || false,
              constructorData: item.constructorData ? JSON.stringify(item.constructorData) : null,
            })),
          },
        },
        include: { items: true },
      });

      if (actualBonusUsed > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: { bonusPoints: { decrement: actualBonusUsed } },
        });
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

    // Notify client about successful order
    try {
      await notifyOrderCreated(
        String(tgUser.id),
        order.id,
        totalPrice,
        items.length,
        deliveryType || 'delivery',
        bonusEarned,
      );
    } catch (e) {
      console.error('Failed to notify client about order:', e);
    }

    // Notify admin about new order
    try {
      const customerName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Клиент';
      await notifyAdminNewOrder(
        order.id,
        customerName,
        totalPrice,
        items.length,
        deliveryType || 'delivery',
        items.map((item: any) => ({ name: item.name, quantity: item.quantity, price: item.price })),
      );
    } catch (e) {
      console.error('Failed to notify admin about order:', e);
    }

    // Fix 1.7: Return 201 for created order
    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/orders/:id — один заказ
// Fix 1.6: IDOR fix — add ownership check
router.get('/:id', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tgUser = req.telegramUser!;
    const user = await prisma.user.findUnique({ where: { telegramId: String(tgUser.id) } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid order ID' }); return; }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, address: true },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    if (order.userId !== user.id) { res.status(403).json({ error: 'Access denied' }); return; }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

export { router as orderRoutes };
