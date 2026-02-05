import { Router, Response } from 'express';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';

const router = Router();
router.use(adminAuth);

// GET /api/admin/analytics — основные метрики
router.get('/', async (_req: AdminRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalOrders,
      todayOrders,
      monthOrders,
      totalUsers,
      totalRevenue,
      monthRevenue,
      ordersByStatus,
      topBouquets,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.user.count(),
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { paymentStatus: 'paid' },
      }),
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { paymentStatus: 'paid', createdAt: { gte: monthStart } },
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.orderItem.groupBy({
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

    const revenueByDay = await prisma.$queryRawUnsafe<{ date: string; revenue: number }[]>(
      `SELECT DATE(\"createdAt\") as date, SUM("totalPrice") as revenue
       FROM "Order"
       WHERE "paymentStatus" = 'paid' AND "createdAt" >= $1
       GROUP BY DATE("createdAt")
       ORDER BY date ASC`,
      thirtyDaysAgo
    );

    res.json({
      totalOrders,
      todayOrders,
      monthOrders,
      totalUsers,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
      monthRevenue: monthRevenue._sum.totalPrice || 0,
      ordersByStatus: ordersByStatus.map((s) => ({ status: s.status, count: s._count })),
      topBouquets: topBouquets.map((b) => ({ name: b.name, count: b._sum.quantity || 0 })),
      revenueByDay: revenueByDay.map((r) => ({ date: r.date, revenue: Number(r.revenue) })),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export { router as adminAnalyticsRoutes };
