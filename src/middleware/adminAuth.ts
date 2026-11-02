import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

// The password early deployments were seeded with. It is public, so the admin panel forces a change.
export const DEFAULT_ADMIN_PASSWORD = 'admin123';

export interface AdminRequest extends Request {
  adminId?: number;
}

export async function adminAuth(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ error: 'Server auth not configured' });
      return;
    }
    const payload = jwt.verify(token, jwtSecret) as { adminId: number; v?: number };

    // Tokens issued before a password change stop working
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.adminId },
      select: { tokenVersion: true },
    });
    if (!admin || admin.tokenVersion !== (payload.v ?? 0)) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    req.adminId = payload.adminId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
