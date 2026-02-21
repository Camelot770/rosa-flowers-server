import { Router, Response } from 'express';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';

const router = Router();
router.use(adminAuth);

// GET /api/admin/users — all users with order count
router.get('/', async (_req: AdminRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
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
    });

    res.json(users.map((u) => ({
      ...u,
      telegramId: u.telegramId || null,
      maxId: u.maxId || null,
      platform: u.telegramId ? 'telegram' : u.maxId ? 'max' : 'unknown',
      ordersCount: u._count.orders,
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
          },
        },
        loyaltyHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        addresses: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      ...user,
      telegramId: user.telegramId || null,
      maxId: user.maxId || null,
      platform: user.telegramId ? 'telegram' : user.maxId ? 'max' : 'unknown',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export { router as adminUserRoutes };
