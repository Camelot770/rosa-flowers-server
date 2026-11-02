import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { notifyOrderStatus } from '../notifications';
import { cancelOrderWithRefund } from '../services/loyalty';
import { cleanText, studioDate } from '../services/orderPricing';

const router = Router();
router.use(adminAuth);

const ORDER_INCLUDE = {
  items: {
    include: {
      bouquet: { select: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
    },
  },
  user: {
    select: {
      id: true, firstName: true, lastName: true, username: true, phone: true, telegramId: true, maxId: true,
      _count: { select: { orders: true } },
    },
  },
  address: true,
} satisfies Prisma.OrderInclude;

// Orders the studio has taken and not finished yet. A paid order becomes "confirmed" by itself.
const ACTIVE_STATUSES = ['confirmed', 'preparing', 'delivering'];

// GET /api/admin/orders — все заказы
router.get('/', async (req: AdminRequest, res: Response) => {
  try {
    const { status } = req.query;
    const where: Prisma.OrderWhereInput = {};
    if (status === 'active') where.status = { in: ACTIVE_STATUSES };
    else if (typeof status === 'string' && status !== 'all') where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/admin/orders/summary — счётчики для меню и главной страницы
router.get('/summary', async (_req: AdminRequest, res: Response) => {
  try {
    const active = { status: { in: ACTIVE_STATUSES } };
    const [activeCount, toStart, awaitingPayment, deliveriesToday, deliveriesTomorrow, overdue] = await Promise.all([
      prisma.order.count({ where: active }),
      prisma.order.count({ where: { status: 'confirmed' } }),
      prisma.order.count({ where: { status: 'new' } }),
      prisma.order.count({ where: { ...active, deliveryDate: studioDate() } }),
      prisma.order.count({ where: { ...active, deliveryDate: studioDate(1) } }),
      // The lower bound keeps out dates written in another format, the checkouts send YYYY-MM-DD
      prisma.order.count({ where: { ...active, deliveryDate: { gte: '2020-01-01', lt: studioDate() } } }),
    ]);

    res.json({ active: activeCount, toStart, awaitingPayment, deliveriesToday, deliveriesTomorrow, overdue });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order summary' });
  }
});

const VALID_STATUSES = ['new', 'confirmed', 'preparing', 'delivering', 'completed', 'canceled'];

const STATUS_LABELS: Record<string, string> = {
  new: 'Ждёт оплаты',
  confirmed: 'Подтверждён',
  preparing: 'Готовится',
  delivering: 'В доставке',
  completed: 'Выполнен',
  canceled: 'Отменён',
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new: ['confirmed', 'canceled'],
  confirmed: ['preparing', 'canceled'],
  preparing: ['delivering', 'canceled'],
  delivering: ['completed', 'canceled'],
  completed: [],
  canceled: [],
};

// One step back for a wrong tap. The customer already heard about the later step, so going back stays silent.
const BACK_TRANSITIONS: Record<string, string> = {
  confirmed: 'new',
  preparing: 'confirmed',
  delivering: 'preparing',
  completed: 'delivering',
};

// PUT /api/admin/orders/:id/status — сменить статус
router.put('/:id/status', async (req: AdminRequest, res: Response) => {
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
    const currentOrder = await prisma.order.findUnique({ where: { id }, select: { status: true, paymentStatus: true } });
    if (!currentOrder) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const allowed = ALLOWED_TRANSITIONS[currentOrder.status] || [];
    const isBack = BACK_TRANSITIONS[currentOrder.status] === status;
    if (!allowed.includes(status) && !isBack) {
      res.status(400).json({
        error: `Заказ уже в статусе «${STATUS_LABELS[currentOrder.status]}», перейти в «${STATUS_LABELS[status]}» нельзя. Обновите страницу.`,
      });
      return;
    }
    // A paid order becomes "confirmed" on payment, "new" would mean it still waits for the money
    if (status === 'new' && currentOrder.paymentStatus === 'paid') {
      res.status(400).json({ error: 'Заказ оплачен, вернуть его в «Ждёт оплаты» нельзя' });
      return;
    }

    if (status === 'canceled') {
      await cancelOrderWithRefund(id);
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { id: true, telegramId: true, maxId: true, firstName: true } },
      },
    });

    // Notify user via correct platform
    if (!isBack) {
      try {
        await notifyOrderStatus(order.user.id, order.id, status, order.deliveryType);
      } catch (e) {
        console.error('Failed to notify user:', e);
      }
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// GET /api/admin/orders/:id — один заказ
router.get('/:id', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    const order = await prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });

    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PATCH /api/admin/orders/:id — поменять доставку, получателя, открытку или заметку студии. Суммы не меняются.
router.patch('/:id', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    const body = req.body || {};
    const data: Prisma.OrderUpdateInput = {};

    if ('deliveryDate' in body) {
      const date = cleanText(body.deliveryDate, 32);
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'Проверьте дату доставки' });
        return;
      }
      data.deliveryDate = date;
    }
    if ('recipientPhone' in body) {
      const phone = cleanText(body.recipientPhone, 32);
      if (phone && phone.replace(/\D/g, '').length < 10) {
        res.status(400).json({ error: 'В телефоне получателя нужно минимум 10 цифр' });
        return;
      }
      data.recipientPhone = phone;
    }
    if ('deliveryTime' in body) data.deliveryTime = cleanText(body.deliveryTime, 32);
    if ('recipientName' in body) data.recipientName = cleanText(body.recipientName, 100);
    if ('cardText' in body) data.cardText = cleanText(body.cardText, 1000);
    if ('adminNote' in body) data.adminNote = cleanText(body.adminNote, 2000);

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'Нечего сохранять' });
      return;
    }

    const exists = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }

    const order = await prisma.order.update({ where: { id }, data, include: ORDER_INCLUDE });
    res.json(order);
  } catch (error) {
    console.error('Order edit error:', error);
    res.status(500).json({ error: 'Не удалось сохранить заказ' });
  }
});

export { router as adminOrderRoutes };
