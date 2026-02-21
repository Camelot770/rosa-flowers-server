import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

const PUBLIC_SETTINGS_KEYS = [
  'studio_name', 'phone', 'email', 'address', 'work_hours',
  'delivery_price', 'free_delivery_from', 'min_order',
  'bonus_percent', 'max_bonus_discount',
  'telegram_link', 'instagram_link',
];

// GET /api/settings — public settings only
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: PUBLIC_SETTINGS_KEYS } },
    });
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
