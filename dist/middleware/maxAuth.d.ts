import { Request, Response, NextFunction } from 'express';
export interface MaxUser {
    id: number;
    name?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
}
export interface MaxAuthenticatedRequest extends Request {
    maxUser?: MaxUser;
}
export declare function maxAuth(req: MaxAuthenticatedRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=maxAuth.d.ts.map