import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// Helper: parse tags from JSON string to array
function parseTags(bouquet: any) {
  try {
    bouquet.tags = typeof bouquet.tags === 'string' ? JSON.parse(bouquet.tags) : bouquet.tags;
  } catch {
    bouquet.tags = [];
  }
  return bouquet;
}

// GET /api/bouquets — список всех букетов
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, search, sort, isHit, isNew, priceMin, priceMax } = req.query;

    const where: any = { inStock: true };
    if (category && category !== 'all') {
      where.category = category as string;
    }
    if (priceMin || priceMax) {
      where.price = {};
      if (priceMin) where.price.gte = parseInt(priceMin as string);
      if (priceMax) where.price.lte = parseInt(priceMax as string);
    }
    if (isHit === 'true') {
      where.isHit = true;
    }
    if (isNew === 'true') {
      where.isNew = true;
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { description: { contains: search as string } },
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

    res.json(bouquets.map(parseTags));
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
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid bouquet ID' });
      return;
    }
    const bouquet = await prisma.bouquet.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!bouquet) {
      res.status(404).json({ error: 'Bouquet not found' });
      return;
    }

    res.json(parseTags(bouquet));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bouquet' });
  }
});

export { router as bouquetRoutes };
