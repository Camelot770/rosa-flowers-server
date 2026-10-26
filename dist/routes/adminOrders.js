"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOrderRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const adminAuth_1 = require("../middleware/adminAuth");
const notifications_1 = require("../notifications");
const router = (0, express_1.Router)();
exports.adminOrderRoutes = router;
router.use(adminAuth_1.adminAuth);
// GET /api/admin/orders — все заказы
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};
        if (status && status !== 'all')
            where.status = status;
        const orders = await index_1.prisma.order.findMany({
            where,
            include: {
                items: {
                    include: {
                        bouquet: { select: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
                    },
                },
                user: { select: { id: true, firstName: true, lastName: true, username: true, phone: true, telegramId: true, maxId: true } },
                address: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(orders);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});
const VALID_STATUSES = ['new', 'confirmed', 'preparing', 'delivering', 'completed', 'canceled'];
const ALLOWED_TRANSITIONS = {
    new: ['confirmed', 'canceled'],
    confirmed: ['preparing', 'canceled'],
    preparing: ['delivering', 'canceled'],
    delivering: ['completed', 'canceled'],
    completed: [],
    canceled: [],
};
// PUT /api/admin/orders/:id/status — сменить статус
router.put('/:id/status', async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid order ID' });
            return;
        }
        const { status } = req.body;
        if (!status || !VALID_STATUSES.includes(status)) {
            res.status(400).json({ error: 'Invalid status' });
            return;
        }
        // Validate status transition
        const currentOrder = await index_1.prisma.order.findUnique({ where: { id }, select: { status: true } });
        if (!currentOrder) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        const allowed = ALLOWED_TRANSITIONS[currentOrder.status] || [];
        if (!allowed.includes(status)) {
            res.status(400).json({ error: `Нельзя сменить статус с "${currentOrder.status}" на "${status}"` });
            return;
        }
        const order = await index_1.prisma.order.update({
            where: { id },
            data: { status },
            include: {
                user: { select: { id: true, telegramId: true, maxId: true, firstName: true } },
            },
        });
        // Notify user via correct platform
        try {
            await (0, notifications_1.notifyOrderStatus)(order.user.id, order.id, status);
        }
        catch (e) {
            console.error('Failed to notify user:', e);
        }
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update order status' });
    }
});
// GET /api/admin/orders/:id — один заказ
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid order ID' });
            return;
        }
        const order = await index_1.prisma.order.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        bouquet: { select: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
                    },
                },
                user: { select: { id: true, firstName: true, lastName: true, username: true, phone: true, telegramId: true, maxId: true } },
                address: true,
            },
        });
        if (!order) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});
//# sourceMappingURL=adminOrders.js.map