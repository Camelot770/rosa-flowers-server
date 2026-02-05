import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/constructor — все элементы конструктора
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [flowers, greenery, packaging] = await Promise.all([
      prisma.flower.findMany({ where: { inStock: true } }),
      prisma.greenery.findMany({ where: { inStock: true } }),
      prisma.packaging.findMany({ where: { inStock: true } }),
    ]);

    res.json({ flowers, greenery, packaging });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch constructor items' });
  }
});

export { router as constructorRoutes };
