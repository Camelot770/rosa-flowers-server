import { Router, Response } from 'express';
import { messengerAuth, MessengerAuthenticatedRequest } from '../middleware/messengerAuth';
import { notifyAdminContactMessage } from '../notifications';

const router = Router();

// POST /api/contact — send message to admin
router.post('/', messengerAuth, async (req: MessengerAuthenticatedRequest, res: Response) => {
  try {
    const mu = req.messengerUser!;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (message.length > 2000) {
      res.status(400).json({ error: 'Message too long' });
      return;
    }

    const senderName = mu.firstName + (mu.lastName ? ` ${mu.lastName}` : '') || 'Клиент';
    const senderUsername = mu.username || null;
    const platformLabel = mu.platform === 'telegram' ? 'Telegram' : 'Max';

    await notifyAdminContactMessage(
      senderName,
      senderUsername,
      `${platformLabel}: ${mu.platformId}`,
      message.trim(),
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending contact message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export { router as contactRoutes };
