"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuthRoutes = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../index");
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
exports.adminAuthRoutes = router;
// POST /api/admin/auth/login
router.post('/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        const admin = await index_1.prisma.adminUser.findUnique({ where: { login } });
        if (!admin) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(password, admin.password);
        if (!valid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            res.status(500).json({ error: 'Server auth not configured' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ adminId: admin.id }, jwtSecret, { expiresIn: '7d' });
        res.json({ token, admin: { id: admin.id, login: admin.login, name: admin.name } });
    }
    catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});
// GET /api/admin/auth/me
router.get('/me', adminAuth_1.adminAuth, async (req, res) => {
    try {
        const admin = await index_1.prisma.adminUser.findUnique({
            where: { id: req.adminId },
            select: { id: true, login: true, name: true },
        });
        res.json(admin);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get admin info' });
    }
});
//# sourceMappingURL=adminAuth.js.map