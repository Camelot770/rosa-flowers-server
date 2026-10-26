import { Request, Response, NextFunction } from 'express';
import { TelegramUser } from './telegramAuth';
import { MaxUser } from './maxAuth';
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
export declare function messengerAuth(req: MessengerAuthenticatedRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=messengerAuth.d.ts.map