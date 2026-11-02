import { Request, Response, NextFunction } from 'express';
export interface AdminRequest extends Request {
    adminId?: number;
}
export declare function adminAuth(req: AdminRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=adminAuth.d.ts.map