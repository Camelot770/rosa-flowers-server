import { Router, Response } from 'express';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';

const router = Router();
router.use(adminAuth);

// GET /api/admin/loyalty — все пользователи с бонусами
router.get('/', async (_req: AdminRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { bonusPoints: { gt: 0 } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        phone: true,
        bonusPoints: true,
        telegramId: true,
      },
      orderBy: { bonusPoints: 'desc' },
    });

    res.json(users.map((u) => ({ ...u, telegramId: u.telegramId.toString() })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loyalty data' });
  }
});

// GET /api/admin/loyalty/:userId — история бонусов пользователя
router.get('/:userId', async (req: AdminRequest, res: Response) => {
  try {
    const userId = parseInt(String(req.params.userId));
    const history = await prisma.loyaltyHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { bonusPoints: true, firstName: true, lastName: true },
    });

    res.json({ user, history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loyalty history' });
  }
});

// POST /api/admin/loyalty/:userId/adjust — ручная корректировка бонусов
router.post('/:userId/adjust', async (req: AdminRequest, res: Response) => {
  try {
    const userId = parseInt(String(req.params.userId));
    const { amount, description } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: { bonusPoints: { increment: amount } },
    });

    await prisma.loyaltyHistory.create({
      data: {
        userId,
        amount,
        type: amount > 0 ? 'earn' : 'spend',
        description: description || 'Ручная корректировка',
      },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to adjust bonus' });
  }
});

export { router as adminLoyaltyRoutes };
