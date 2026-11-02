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
    const { category, search, sort, isHit, isNew, featured, priceMin, priceMax, minPrice, maxPrice } = req.query;

    const where: any = { inStock: true };
    if (category && category !== 'all') {
      where.category = category as string;
    }
    // minPrice/maxPrice are what older mini-app builds send
    const min = parseInt(String(priceMin ?? minPrice));
    const max = parseInt(String(priceMax ?? maxPrice));
    if (!isNaN(min) || !isNaN(max)) {
      where.price = {};
      if (!isNaN(min)) where.price.gte = min;
      if (!isNaN(max)) where.price.lte = max;
    }
    if (isHit === 'true') {
      where.isHit = true;
    }
    if (isNew === 'true') {
      where.isNew = true;
    }
    if (featured === 'true') {
      where.isFeatured = true;
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

    // Filtered here because SQLite LIKE ignores case for ASCII only, so "соната" would miss "Соната"
    const query = typeof search === 'string' ? search.trim().toLowerCase() : '';
    const found = query
      ? bouquets.filter((b) => b.name.toLowerCase().includes(query) || b.description.toLowerCase().includes(query))
      : bouquets;

    res.json(found.map(parseTags));
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
