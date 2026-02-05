import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/bouquets — список всех букетов
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, search, sort } = req.query;

    const where: any = { inStock: true };
    if (category && category !== 'all') {
      where.category = category as string;
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { sortOrder: 'asc' };
    if (sort === 'price_asc') orderBy = { price: 'asc' };
    if (sort === 'price_desc') orderBy = { price: 'desc' };
    if (sort === 'new') orderBy = { createdAt: 'desc' };

    const bouquets = await prisma.bouquet.findMany({
      where,
      orderBy,
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });

    res.json(bouquets);
  } catch (error) {
    console.error('Error fetching bouquets:', error);
    res.status(500).json({ error: 'Failed to fetch bouquets' });
  }
});

// GET /api/bouquets/categories
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.bouquet.findMany({
      where: { inStock: true },
      select: { category: true },
      distinct: ['category'],
    });
    res.json(categories.map((c) => c.category));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/bouquets/:id — один букет
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bouquet = await prisma.bouquet.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!bouquet) {
      res.status(404).json({ error: 'Bouquet not found' });
      return;
    }

    res.json(bouquet);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bouquet' });
  }
});

export { router as bouquetRoutes };
