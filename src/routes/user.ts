import { Router, Response } from 'express';
import { prisma } from '../index';
import { messengerAuth, MessengerAuthenticatedRequest } from '../middleware/messengerAuth';

const router = Router();

// Helper: find user by platform
async function findUserByPlatform(platform: string, platformId: string) {
  if (platform === 'telegram') {
    return prisma.user.findUnique({ where: { telegramId: platformId } });
  }
  return prisma.user.findUnique({ where: { maxId: platformId } });
}

// GET /api/user/profile — профиль пользователя
router.get('/profile', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;

    const whereClause = mu.platform === 'telegram'
      ? { telegramId: mu.platformId }
      : { maxId: mu.platformId };

    const createData = mu.platform === 'telegram'
      ? { telegramId: mu.platformId }
      : { maxId: mu.platformId };

    const user = await prisma.user.upsert({
      where: whereClause,
      update: {
        firstName: mu.firstName,
        lastName: mu.lastName || null,
        username: mu.username || null,
        photoUrl: mu.photoUrl || null,
      },
      create: {
        ...createData,
        firstName: mu.firstName,
        lastName: mu.lastName || null,
        username: mu.username || null,
        photoUrl: mu.photoUrl || null,
      },
      include: {
        addresses: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Error in user profile:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// PUT /api/user/phone — обновить телефон
router.put('/phone', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const { phone } = req.body;

    if (!phone || typeof phone !== 'string' || phone.length > 20) {
      res.status(400).json({ error: 'Invalid phone number' });
      return;
    }

    const whereClause = mu.platform === 'telegram'
      ? { telegramId: mu.platformId }
      : { maxId: mu.platformId };

    const user = await prisma.user.update({
      where: whereClause,
      data: { phone },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update phone' });
  }
});

// POST /api/user/address — добавить адрес
router.post('/address', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const user = await findUserByPlatform(mu.platform, mu.platformId);
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
router.delete('/address/:id', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const user = await findUserByPlatform(mu.platform, mu.platformId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid address ID' }); return; }

    // Verify ownership
    const address = await prisma.address.findUnique({ where: { id } });
    if (!address) { res.status(404).json({ error: 'Address not found' }); return; }
    if (address.userId !== user.id) { res.status(403).json({ error: 'Access denied' }); return; }

    // Unlink from orders before deleting
    await prisma.order.updateMany({ where: { addressId: id }, data: { addressId: null } });
    await prisma.address.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// GET /api/user/loyalty — история бонусов
router.get('/loyalty', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const user = await findUserByPlatform(mu.platform, mu.platformId);
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
