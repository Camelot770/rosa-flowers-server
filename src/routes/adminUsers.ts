import { Router, Response } from 'express';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { messageUser } from '../notifications';

const router = Router();
router.use(adminAuth);

const PAID_ORDER = { paymentStatus: 'paid', status: { not: 'canceled' } };

// GET /api/admin/users — all users with order count
router.get('/', async (_req: AdminRequest, res: Response) => {
  try {
    const [users, paid, last, phones] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          telegramId: true,
          maxId: true,
          firstName: true,
          lastName: true,
          username: true,
          phone: true,
          bonusPoints: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.groupBy({ by: ['userId'], where: PAID_ORDER, _sum: { totalPrice: true }, _count: true }),
      prisma.order.groupBy({ by: ['userId'], _max: { createdAt: true } }),
      // Mini-app customers have no phone of their own, the latest order at least gives a number to call
      prisma.order.findMany({
        where: { recipientPhone: { not: null } },
        distinct: ['userId'],
        orderBy: { createdAt: 'desc' },
        select: { userId: true, recipientPhone: true },
      }),
    ]);
    const paidBy = new Map(paid.map((p) => [p.userId, p]));
    const lastBy = new Map(last.map((l) => [l.userId, l._max.createdAt]));
    const phoneBy = new Map(phones.map((p) => [p.userId, p.recipientPhone]));

    res.json(users.map((u) => ({
      ...u,
      telegramId: u.telegramId || null,
      maxId: u.maxId || null,
      platform: u.telegramId ? 'telegram' : u.maxId ? 'max' : 'unknown',
      ordersCount: u._count.orders,
      paidOrders: paidBy.get(u.id)?._count || 0,
      totalSpent: paidBy.get(u.id)?._sum.totalPrice || 0,
      lastOrderAt: lastBy.get(u.id) || null,
      orderPhone: phoneBy.get(u.id) || null,
      _count: undefined,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/users/:id — user detail with orders and loyalty history
router.get('/:id', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            status: true,
            totalPrice: true,
            paymentStatus: true,
            createdAt: true,
            deliveryDate: true,
            recipientPhone: true,
          },
        },
        loyaltyHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        addresses: { where: { deletedAt: null } },
        _count: { select: { orders: true } },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const paid = await prisma.order.aggregate({ where: { userId: id, ...PAID_ORDER }, _sum: { totalPrice: true }, _count: true });

    res.json({
      ...user,
      telegramId: user.telegramId || null,
      maxId: user.maxId || null,
      platform: user.telegramId ? 'telegram' : user.maxId ? 'max' : 'unknown',
      ordersCount: user._count.orders,
      paidOrders: paid._count,
      totalSpent: paid._sum.totalPrice || 0,
      _count: undefined,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/admin/users/:id/message — написать клиенту через бота
router.post('/:id/message', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > 4000) {
      res.status(400).json({ error: 'Напишите сообщение, до 4000 символов' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { telegramId: true, maxId: true } });
    if (!user) {
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }
    if (!user.telegramId && !user.maxId) {
      res.status(400).json({ error: 'Клиент заказывал на сайте, бот ему написать не может. Позвоните по телефону.' });
      return;
    }

    if (!(await messageUser(user, message))) {
      res.status(502).json({ error: 'Не доставлено: возможно, клиент заблокировал бота. Позвоните по телефону.' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Message to a customer failed:', error);
    res.status(500).json({ error: 'Не удалось отправить сообщение' });
  }
});

export { router as adminUserRoutes };
