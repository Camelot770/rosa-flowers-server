import { Router, Response } from 'express';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { studioDate } from '../services/orderPricing';

const router = Router();
router.use(adminAuth);

const PERIODS = [7, 30, 90];

// Money the studio keeps: a paid order that was canceled is refunded by hand
const PAID_ORDER = { paymentStatus: 'paid', status: { not: 'canceled' } };

const dayStart = (date: string) => new Date(`${date}T00:00:00+03:00`);

// GET /api/admin/analytics — основные метрики
router.get('/', async (req: AdminRequest, res: Response) => {
  try {
    const requested = parseInt(String(req.query.days));
    const days = PERIODS.includes(requested) ? requested : 30;

    const today = dayStart(studioDate());
    const monthStart = dayStart(`${studioDate().slice(0, 7)}-01`);
    const periodStart = dayStart(studioDate(1 - days));

    const [
      totalOrders,
      todayOrders,
      monthOrders,
      totalCustomers,
      totalBouquets,
      totalRevenue,
      todayRevenue,
      monthRevenue,
      ordersByStatus,
      topBouquets,
      periodOrders,
      bouquets,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.user.count(),
      prisma.bouquet.count(),
      prisma.order.aggregate({ _sum: { totalPrice: true }, where: PAID_ORDER }),
      prisma.order.aggregate({ _sum: { totalPrice: true }, where: { ...PAID_ORDER, createdAt: { gte: today } } }),
      prisma.order.aggregate({ _sum: { totalPrice: true }, _count: true, where: { ...PAID_ORDER, createdAt: { gte: monthStart } } }),
      prisma.order.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.orderItem.groupBy({
        by: ['name'],
        where: { order: PAID_ORDER },
        _count: true,
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: periodStart } },
        select: {
          totalPrice: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          user: { select: { telegramId: true, maxId: true } },
        },
      }),
      prisma.bouquet.findMany({
        select: { id: true, name: true, inStock: true, customOrder: true, isFeatured: true, _count: { select: { images: true } } },
      }),
    ]);

    // Revenue by day and by source, days without sales stay on the chart
    const revenueByDay = Array.from({ length: days }, (_, i) => ({ date: studioDate(i + 1 - days), revenue: 0, orders: 0 }));
    const dayIndex = new Map(revenueByDay.map((d, i) => [d.date, i]));
    const sources: Record<string, { source: string; orders: number; revenue: number }> = {
      telegram: { source: 'telegram', orders: 0, revenue: 0 },
      max: { source: 'max', orders: 0, revenue: 0 },
      web: { source: 'web', orders: 0, revenue: 0 },
    };
    let periodRevenue = 0;
    let periodPaid = 0;
    for (const order of periodOrders) {
      if (order.paymentStatus !== 'paid' || order.status === 'canceled') continue;
      periodRevenue += order.totalPrice;
      periodPaid += 1;
      const date = new Date(order.createdAt.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const index = dayIndex.get(date);
      if (index !== undefined) {
        revenueByDay[index].revenue += order.totalPrice;
        revenueByDay[index].orders += 1;
      }
      const source = sources[order.user.telegramId ? 'telegram' : order.user.maxId ? 'max' : 'web'];
      source.orders += 1;
      source.revenue += order.totalPrice;
    }

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const featured = bouquets.find((b) => b.isFeatured);

    res.json({
      totalOrders,
      todayOrders,
      monthOrders,
      totalUsers: totalCustomers,
      totalCustomers,
      totalBouquets,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
      todayRevenue: todayRevenue._sum.totalPrice || 0,
      monthRevenue: monthRevenue._sum.totalPrice || 0,
      monthPaidOrders: monthRevenue._count,
      period: {
        days,
        orders: periodOrders.length,
        paidOrders: periodPaid,
        revenue: periodRevenue,
        averageCheck: periodPaid ? Math.round(periodRevenue / periodPaid) : 0,
      },
      sources: Object.values(sources),
      catalog: {
        total: bouquets.length,
        onSale: bouquets.filter((b) => b.inStock || b.customOrder).length,
        noPhoto: bouquets.filter((b) => b._count.images === 0).length,
        featured: featured ? { id: featured.id, name: featured.name, available: featured.inStock || featured.customOrder } : null,
      },
      ordersByStatus: ordersByStatus.map((s) => ({ status: s.status, count: s._count })),
      topBouquets: topBouquets.map((b) => ({ name: b.name, count: b._sum.quantity || 0 })),
      revenueByDay,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        status: o.status,
        totalPrice: o.totalPrice,
        paymentStatus: o.paymentStatus,
        customerName: [o.user.firstName, o.user.lastName].filter(Boolean).join(' '),
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export { router as adminAnalyticsRoutes };
