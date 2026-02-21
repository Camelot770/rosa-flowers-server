import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';

const router = Router();

// POST /api/admin/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { login, password } = req.body;

    const admin = await prisma.adminUser.findUnique({ where: { login } });
    if (!admin) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ error: 'Server auth not configured' });
      return;
    }
    const token = jwt.sign({ adminId: admin.id }, jwtSecret, { expiresIn: '7d' });

    res.json({ token, admin: { id: admin.id, login: admin.login, name: admin.name } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/admin/auth/me
router.get('/me', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: req.adminId },
      select: { id: true, login: true, name: true },
    });
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get admin info' });
  }
});

export { router as adminAuthRoutes };
