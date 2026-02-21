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

// GET /api/favorites — избранное
router.get('/', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const user = await findUserByPlatform(mu.platform, mu.platformId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      include: {
        bouquet: {
          include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(favorites);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// POST /api/favorites/:bouquetId — добавить в избранное
router.post('/:bouquetId', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const user = await findUserByPlatform(mu.platform, mu.platformId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const bouquetId = parseInt(String(req.params.bouquetId));

    const favorite = await prisma.favorite.upsert({
      where: { userId_bouquetId: { userId: user.id, bouquetId } },
      update: {},
      create: { userId: user.id, bouquetId },
    });

    res.json(favorite);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add to favorites' });
  }
});

// DELETE /api/favorites/:bouquetId — убрать из избранного
router.delete('/:bouquetId', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const user = await findUserByPlatform(mu.platform, mu.platformId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const bouquetId = parseInt(String(req.params.bouquetId));

    await prisma.favorite.deleteMany({
      where: { userId: user.id, bouquetId },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove from favorites' });
  }
});

export { router as favoriteRoutes };
