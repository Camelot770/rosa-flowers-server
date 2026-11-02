import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { adminAuth, AdminRequest, DEFAULT_ADMIN_PASSWORD } from '../middleware/adminAuth';

const router = Router();

function signToken(admin: { id: number; tokenVersion: number }, jwtSecret: string): string {
  return jwt.sign({ adminId: admin.id, v: admin.tokenVersion }, jwtSecret, { expiresIn: '7d' });
}

// POST /api/admin/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { login, password } = req.body;
    if (typeof login !== 'string' || typeof password !== 'string') {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

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
    const token = signToken(admin, jwtSecret);

    res.json({
      token,
      admin: { id: admin.id, login: admin.login, name: admin.name },
      mustChangePassword: password === DEFAULT_ADMIN_PASSWORD,
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/admin/auth/me
router.get('/me', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const admin = await prisma.adminUser.findUnique({ where: { id: req.adminId } });
    if (!admin) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    res.json({
      id: admin.id,
      login: admin.login,
      name: admin.name,
      mustChangePassword: await bcrypt.compare(DEFAULT_ADMIN_PASSWORD, admin.password),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get admin info' });
  }
});

// PUT /api/admin/auth/password — сменить пароль. Все ранее выданные токены перестают работать.
router.put('/password', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'Укажите текущий и новый пароль' });
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
      res.status(400).json({ error: 'Новый пароль должен быть от 8 до 72 символов' });
      return;
    }
    if (newPassword === DEFAULT_ADMIN_PASSWORD) {
      res.status(400).json({ error: 'Этот пароль нельзя использовать, он есть в открытом доступе' });
      return;
    }

    const admin = await prisma.adminUser.findUnique({ where: { id: req.adminId } });
    if (!admin) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    if (!(await bcrypt.compare(currentPassword, admin.password))) {
      res.status(400).json({ error: 'Текущий пароль указан неверно' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ error: 'Server auth not configured' });
      return;
    }

    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { password: await bcrypt.hash(newPassword, 10), tokenVersion: { increment: 1 } },
    });

    res.json({ token: signToken(updated, jwtSecret) });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось сменить пароль' });
  }
});

export { router as adminAuthRoutes };
