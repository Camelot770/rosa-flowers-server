import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/settings — все настройки (публичные)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

export { router as settingsRoutes };
