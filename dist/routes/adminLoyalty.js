"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLoyaltyRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
exports.adminLoyaltyRoutes = router;
router.use(adminAuth_1.adminAuth);
// GET /api/admin/loyalty — все пользователи с бонусами
router.get('/', async (_req, res) => {
    try {
        const users = await index_1.prisma.user.findMany({
            select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                phone: true,
                bonusPoints: true,
                telegramId: true,
                maxId: true,
            },
            orderBy: { bonusPoints: 'desc' },
        });
        res.json(users.map((u) => ({ ...u, telegramId: u.telegramId || null, maxId: u.maxId || null })));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch loyalty data' });
    }
});
// GET /api/admin/loyalty/:userId — история бонусов пользователя
router.get('/:userId', async (req, res) => {
    try {
        const userId = parseInt(String(req.params.userId));
        const history = await index_1.prisma.loyaltyHistory.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        const user = await index_1.prisma.user.findUnique({
            where: { id: userId },
            select: { bonusPoints: true, firstName: true, lastName: true },
        });
        res.json({ user, history });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch loyalty history' });
    }
});
// POST /api/admin/loyalty/:userId/adjust — ручная корректировка бонусов
router.post('/:userId/adjust', async (req, res) => {
    try {
        const userId = parseInt(String(req.params.userId));
        const { amount, description } = req.body;
        if (typeof amount !== 'number' || amount === 0 || isNaN(amount)) {
            res.status(400).json({ error: 'Amount must be a non-zero number' });
            return;
        }
        // Check balance won't go negative
        if (amount < 0) {
            const user = await index_1.prisma.user.findUnique({ where: { id: userId }, select: { bonusPoints: true } });
            if (!user || user.bonusPoints + amount < 0) {
                res.status(400).json({ error: 'Insufficient bonus points' });
                return;
            }
        }
        await index_1.prisma.$transaction([
            index_1.prisma.user.update({
                where: { id: userId },
                data: { bonusPoints: { increment: amount } },
            }),
            index_1.prisma.loyaltyHistory.create({
                data: {
                    userId,
                    amount,
                    type: amount > 0 ? 'earn' : 'spend',
                    description: description || 'Ручная корректировка',
                },
            }),
        ]);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to adjust bonus' });
    }
});
//# sourceMappingURL=adminLoyalty.js.map