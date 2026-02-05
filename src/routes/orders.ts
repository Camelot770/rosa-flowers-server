import { Router, Response } from 'express';
import { prisma } from '../index';
import { telegramAuth, AuthenticatedRequest } from '../middleware/telegramAuth';
import { earnBonus, spendBonus } from '../services/loyalty';

const router = Router();

// GET /api/orders — мои заказы
router.get('/', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tgUser = req.telegramUser!;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tgUser.id) } });
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
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tgUser.id) } });
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

    // Calculate total price
    let totalPrice = 0;
    for (const item of items) {
      totalPrice += item.price * item.quantity;
    }

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

    // Calculate bonus earned (5%)
    const bonusPercent = parseInt(
      (await prisma.setting.findUnique({ where: { key: 'bonus_percent' } }))?.value || '5'
    );
    const bonusEarned = Math.floor((totalPrice * bonusPercent) / 100);

    const order = await prisma.order.create({
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

    // Spend bonus points
    if (actualBonusUsed > 0) {
      await spendBonus(user.id, actualBonusUsed, order.id);
    }

    res.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/orders/:id — один заказ
router.get('/:id', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: { items: true, address: true },
    });

    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

export { router as orderRoutes };
