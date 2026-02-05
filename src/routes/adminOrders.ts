import { Router, Response } from 'express';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { notifyOrderStatus } from '../bot';

const router = Router();
router.use(adminAuth);

// GET /api/admin/orders — все заказы
router.get('/', async (req: AdminRequest, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status && status !== 'all') where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        user: { select: { id: true, firstName: true, lastName: true, username: true, phone: true, telegramId: true } },
        address: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Serialize BigInt in user telegramId
    const serialized = orders.map((o) => ({
      ...o,
      user: {
        ...o.user,
        telegramId: o.user.telegramId.toString(),
      },
    }));

    res.json(serialized);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// PUT /api/admin/orders/:id/status — сменить статус
router.put('/:id/status', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { status } = req.body;

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { telegramId: true, firstName: true } },
      },
    });

    // Notify user via Telegram
    try {
      await notifyOrderStatus(order.user.telegramId.toString(), order.id, status);
    } catch (e) {
      console.error('Failed to notify user:', e);
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// GET /api/admin/orders/:id — один заказ
router.get('/:id', async (req: AdminRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: {
        items: true,
        user: { select: { id: true, firstName: true, lastName: true, username: true, phone: true, telegramId: true } },
        address: true,
      },
    });

    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

    res.json({
      ...order,
      user: { ...order.user, telegramId: order.user.telegramId.toString() },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

export { router as adminOrderRoutes };
