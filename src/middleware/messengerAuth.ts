import { Request, Response, NextFunction } from 'express';
import { telegramAuth, TelegramUser } from './telegramAuth';
import { maxAuth, MaxUser } from './maxAuth';

export interface MessengerUser {
  platform: 'telegram' | 'max';
  platformId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

export interface MessengerAuthenticatedRequest extends Request {
  messengerUser?: MessengerUser;
  telegramUser?: TelegramUser;
  maxUser?: MaxUser;
}

export function messengerAuth(
  req: MessengerAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const hasTelegramData = !!req.headers['x-telegram-init-data'];
  const hasMaxData = !!req.headers['x-max-init-data'];

  if (hasTelegramData) {
    telegramAuth(req as any, res, (err?: any) => {
      if (err) return next(err);
      const tgUser = (req as any).telegramUser as TelegramUser | undefined;
      if (tgUser) {
        req.messengerUser = {
          platform: 'telegram',
          platformId: String(tgUser.id),
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
          photoUrl: tgUser.photo_url,
        };
        next();
      } else {
        res.status(401).json({ error: 'Telegram auth failed: user data missing' });
      }
    });
  } else if (hasMaxData) {
    maxAuth(req as any, res, (err?: any) => {
      if (err) return next(err);
      const mxUser = (req as any).maxUser as MaxUser | undefined;
      if (mxUser) {
        req.messengerUser = {
          platform: 'max',
          platformId: String(mxUser.id),
          firstName: mxUser.first_name || mxUser.name || 'User',
          lastName: mxUser.last_name,
          username: mxUser.username,
        };
        next();
      } else {
        res.status(401).json({ error: 'Max auth failed: user data missing' });
      }
    });
  } else {
    res.status(401).json({ error: 'Messenger auth data required (Telegram or Max)' });
  }
}
