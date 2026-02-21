import { Router, Response } from 'express';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { broadcastMessage } from '../notifications';

const router = Router();
router.use(adminAuth);

// POST /api/admin/broadcast — send message to all users (both Telegram and Max)
router.post('/', async (req: AdminRequest, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (message.length > 4000) {
      res.status(400).json({ error: 'Message too long (max 4000)' });
      return;
    }

    const result = await broadcastMessage(message.trim());

    res.json({ ...result, total: result.sent + result.failed });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

export { router as adminBroadcastRoutes };
