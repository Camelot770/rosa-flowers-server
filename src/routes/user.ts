import { Router, Response } from 'express';
import { prisma } from '../index';
import { telegramAuth, AuthenticatedRequest } from '../middleware/telegramAuth';

const router = Router();

// GET /api/user/profile — профиль пользователя
router.get('/profile', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tgUser = req.telegramUser!;

    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      update: {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        username: tgUser.username || null,
        photoUrl: tgUser.photo_url || null,
      },
      create: {
        telegramId: BigInt(tgUser.id),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        username: tgUser.username || null,
        photoUrl: tgUser.photo_url || null,
      },
      include: {
        addresses: true,
      },
    });

    // Serialize BigInt
    res.json({
      ...user,
      telegramId: user.telegramId.toString(),
    });
  } catch (error) {
    console.error('Error in user profile:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// PUT /api/user/phone — обновить телефон
router.put('/phone', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tgUser = req.telegramUser!;
    const { phone } = req.body;

    const user = await prisma.user.update({
      where: { telegramId: BigInt(tgUser.id) },
      data: { phone },
    });

    res.json({ ...user, telegramId: user.telegramId.toString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update phone' });
  }
});

// POST /api/user/address — добавить адрес
router.post('/address', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tgUser = req.telegramUser!;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tgUser.id) } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const { title, street, house, apartment, entrance, floor, comment, isDefault } = req.body;

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId: user.id,
        title: title || 'Дом',
        street,
        house,
        apartment,
        entrance,
        floor,
        comment,
        isDefault: isDefault || false,
      },
    });

    res.json(address);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add address' });
  }
});

// DELETE /api/user/address/:id — удалить адрес
router.delete('/address/:id', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.address.delete({ where: { id: parseInt(String(req.params.id)) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// GET /api/user/loyalty — история бонусов
router.get('/loyalty', telegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tgUser = req.telegramUser!;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(tgUser.id) } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const history = await prisma.loyaltyHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ bonusPoints: user.bonusPoints, history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get loyalty history' });
  }
});

export { router as userRoutes };
