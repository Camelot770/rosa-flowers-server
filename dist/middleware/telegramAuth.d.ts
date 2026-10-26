import { Request, Response, NextFunction } from 'express';
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
export declare function telegramAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=telegramAuth.d.ts.map