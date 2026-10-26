"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAnalyticsRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
exports.adminAnalyticsRoutes = router;
router.use(adminAuth_1.adminAuth);
// GET /api/admin/analytics — основные метрики
router.get('/', async (_req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const [totalOrders, todayOrders, monthOrders, totalCustomers, totalBouquets, totalRevenue, monthRevenue, ordersByStatus, topBouquets,] = await Promise.all([
            index_1.prisma.order.count(),
            index_1.prisma.order.count({ where: { createdAt: { gte: today } } }),
            index_1.prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
            index_1.prisma.user.count(),
            index_1.prisma.bouquet.count(),
            index_1.prisma.order.aggregate({
                _sum: { totalPrice: true },
                where: { paymentStatus: 'paid' },
            }),
            index_1.prisma.order.aggregate({
                _sum: { totalPrice: true },
                where: { paymentStatus: 'paid', createdAt: { gte: monthStart } },
            }),
            index_1.prisma.order.groupBy({
                by: ['status'],
                _count: true,
            }),
            index_1.prisma.orderItem.groupBy({
                by: ['name'],
                _count: true,
                _sum: { quantity: true },
                orderBy: { _sum: { quantity: 'desc' } },
                take: 10,
            }),
        ]);
        // Revenue by day (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const revenueByDay = await index_1.prisma.$queryRawUnsafe(`SELECT DATE(createdAt) as date, SUM(totalPrice) as revenue
       FROM "Order"
       WHERE paymentStatus = 'paid' AND createdAt >= ?
       GROUP BY DATE(createdAt)
       ORDER BY date ASC`, thirtyDaysAgo.toISOString());
        // Recent orders
        const recentOrders = await index_1.prisma.order.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { firstName: true, lastName: true } },
            },
        });
        res.json({
            totalOrders,
            todayOrders,
            monthOrders,
            totalUsers: totalCustomers,
            totalCustomers,
            totalBouquets,
            totalRevenue: totalRevenue._sum.totalPrice || 0,
            monthRevenue: monthRevenue._sum.totalPrice || 0,
            ordersByStatus: ordersByStatus.map((s) => ({ status: s.status, count: s._count })),
            topBouquets: topBouquets.map((b) => ({ name: b.name, count: b._sum.quantity || 0 })),
            revenueByDay: (revenueByDay || []).map((r) => ({ date: String(r.date), revenue: Number(r.revenue) || 0 })),
            recentOrders: recentOrders.map((o) => ({
                id: o.id,
                status: o.status,
                totalPrice: o.totalPrice,
                paymentStatus: o.paymentStatus,
                customerName: [o.user.firstName, o.user.lastName].filter(Boolean).join(' '),
                createdAt: o.createdAt,
            })),
        });
    }
    catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});
//# sourceMappingURL=adminAnalytics.js.map