"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUserRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
exports.adminUserRoutes = router;
router.use(adminAuth_1.adminAuth);
// GET /api/admin/users — all users with order count
router.get('/', async (_req, res) => {
    try {
        const users = await index_1.prisma.user.findMany({
            select: {
                id: true,
                telegramId: true,
                maxId: true,
                firstName: true,
                lastName: true,
                username: true,
                phone: true,
                bonusPoints: true,
                createdAt: true,
                _count: { select: { orders: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users.map((u) => ({
            ...u,
            telegramId: u.telegramId || null,
            maxId: u.maxId || null,
            platform: u.telegramId ? 'telegram' : u.maxId ? 'max' : 'unknown',
            ordersCount: u._count.orders,
            _count: undefined,
        })));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// GET /api/admin/users/:id — user detail with orders and loyalty history
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid user ID' });
            return;
        }
        const user = await index_1.prisma.user.findUnique({
            where: { id },
            include: {
                orders: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    select: {
                        id: true,
                        status: true,
                        totalPrice: true,
                        paymentStatus: true,
                        createdAt: true,
                    },
                },
                loyaltyHistory: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
                addresses: true,
            },
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({
            ...user,
            telegramId: user.telegramId || null,
            maxId: user.maxId || null,
            platform: user.telegramId ? 'telegram' : user.maxId ? 'max' : 'unknown',
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
//# sourceMappingURL=adminUsers.js.map