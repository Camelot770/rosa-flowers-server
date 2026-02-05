import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface AuthenticatedRequest extends Request {
  telegramUser?: TelegramUser;
}

export function telegramAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const initData = req.headers['x-telegram-init-data'] as string;

  if (!initData) {
    res.status(401).json({ error: 'Telegram init data required' });
    return;
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const botToken = process.env.BOT_TOKEN!;
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      res.status(401).json({ error: 'Invalid telegram data' });
      return;
    }

    const userStr = params.get('user');
    if (userStr) {
      req.telegramUser = JSON.parse(userStr);
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Auth failed' });
  }
}
