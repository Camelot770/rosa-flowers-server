import { Router, Response } from 'express';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { notifyOrderStatus } from '../notifications';

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
        items: {
          include: {
            bouquet: { select: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
          },
        },
        user: { select: { id: true, firstName: true, lastName: true, username: true, phone: true, telegramId: true, maxId: true } },
        address: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

const VALID_STATUSES = ['new', 'confirmed', 'preparing', 'delivering', 'completed', 'canceled'];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new: ['confirmed', 'canceled'],
  confirmed: ['preparing', 'canceled'],
  preparing: ['delivering', 'canceled'],
  delivering: ['completed', 'canceled'],
  completed: [],
  canceled: [],
};

// PUT /api/admin/orders/:id/status — сменить статус
router.put('/:id/status', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    // Validate status transition
    const currentOrder = await prisma.order.findUnique({ where: { id }, select: { status: true } });
    if (!currentOrder) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const allowed = ALLOWED_TRANSITIONS[currentOrder.status] || [];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `Нельзя сменить статус с "${currentOrder.status}" на "${status}"` });
      return;
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { id: true, telegramId: true, maxId: true, firstName: true } },
      },
    });

    // Notify user via correct platform
    try {
      await notifyOrderStatus(order.user.id, order.id, status);
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
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            bouquet: { select: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
          },
        },
        user: { select: { id: true, firstName: true, lastName: true, username: true, phone: true, telegramId: true, maxId: true } },
        address: true,
      },
    });

    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

export { router as adminOrderRoutes };
