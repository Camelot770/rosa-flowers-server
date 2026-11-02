import { Router, Response } from 'express';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { BROADCAST_AUDIENCES, BroadcastAudience, broadcastAudienceCounts, broadcastMessage, sendTestToAdmins } from '../notifications';

const router = Router();
router.use(adminAuth);

function readMessage(body: any): string | null {
  const message = body?.message;
  if (typeof message !== 'string' || message.trim().length === 0 || message.length > 4000) return null;
  return message.trim();
}

// GET /api/admin/broadcast/audience — сколько людей получит рассылку
router.get('/audience', async (_req: AdminRequest, res: Response) => {
  try {
    res.json(await broadcastAudienceCounts());
  } catch (error) {
    res.status(500).json({ error: 'Failed to count the audience' });
  }
});

// POST /api/admin/broadcast/test — проверить текст: уходит только админам в Telegram
router.post('/test', async (req: AdminRequest, res: Response) => {
  try {
    const message = readMessage(req.body);
    if (!message) {
      res.status(400).json({ error: 'Напишите сообщение, до 4000 символов' });
      return;
    }
    res.json(await sendTestToAdmins(message));
  } catch (error) {
    console.error('Broadcast test error:', error);
    res.status(500).json({ error: 'Не удалось отправить проверку' });
  }
});

// POST /api/admin/broadcast — send message to all users (both Telegram and Max)
router.post('/', async (req: AdminRequest, res: Response) => {
  try {
    const message = readMessage(req.body);
    if (!message) {
      res.status(400).json({ error: 'Напишите сообщение, до 4000 символов' });
      return;
    }

    const audience: BroadcastAudience = BROADCAST_AUDIENCES.includes(req.body.audience) ? req.body.audience : 'all';
    const result = await broadcastMessage(message, audience);

    res.json({ ...result, total: result.sent + result.failed });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

export { router as adminBroadcastRoutes };
