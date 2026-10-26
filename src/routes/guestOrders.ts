/**
 * Guest checkout routes for the rosa-cvetov web shop (no Telegram/Max auth).
 *
 * The existing /api/orders flow requires `messengerAuth` because users
 * arrive from a Mini App with a verified platformId. Visitors of
 * розацветов.рф don't have that — they fill in a form, the studio calls
 * back, and (in M4) pay via YooKassa.
 *
 * Strategy:
 *   1. Validate the cart and recompute totals from DB prices.
 *   2. Find or create a guest User by phone (no telegramId, no maxId).
 *      Phone is normalized to E.164-ish "+7XXXXXXXXXX".
 *   3. Optionally create an Address linked to that user.
 *   4. Create the Order with paymentStatus="pending" (no payment yet —
 *      M4 will add /api/payment/create-guest).
 *   5. Notify admin (Telegram) via the existing notifyAdminNewOrder.
 *
 * Mount in src/index.ts:
 *
 *     import { guestOrderRoutes } from './routes/guestOrders';
 *     app.use('/api/orders', guestOrderRoutes);  // adds POST /api/orders/guest
 *
 * The order is fine after the existing `app.use('/api/orders', orderRoutes)`
 * — Express keeps trying matchers until one handles the request, and the
 * existing router doesn't define POST /guest.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { notifyAdminNewOrder } from '../notifications';

const router = Router();

/* ----------------------------- helpers ----------------------------- */

interface GuestOrderItem {
  bouquetId?: number;
  quantity: number;
  // Names/prices are recomputed from DB; the client value is ignored.
  // We still accept `name`/`price` so the client can show a confirmation
  // without re-fetching, but never trust them.
  name?: string;
  price?: number;
}

interface GuestOrderBody {
  customer: {
    firstName: string;
    lastName?: string;
    phone: string;
    email?: string;
  };
  delivery: {
    type: 'delivery' | 'pickup';
    date?: string;
    time?: string;
    address?: {
      city?: string;
      street: string;
      house: string;
      apartment?: string;
      entrance?: string;
      floor?: string;
      comment?: string;
    };
  };
  recipientName?: string;
  recipientPhone?: string;
  isAnonymous?: boolean;
  cardText?: string;
  comment?: string;
  promoCode?: string;
  items: GuestOrderItem[];
  // M4 will add returnUrl + redirect into payment. For M3 we just create
  // the order and the studio calls back.
}

/**
 * "+7 (917) 876-59-58", "8-917-876-59-58", "79178765958" → "+79178765958"
 * For non-Russian numbers we leave whatever the user typed (just strip spaces).
 */
function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
  if (digits.length === 11 && digits.startsWith('7')) return '+' + digits;
  if (digits.length === 10) return '+7' + digits;
  return '+' + digits;
}

function isValidPhone(p: string): boolean {
  return /^\+\d{10,15}$/.test(p);
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/* ----------------------------- route ------------------------------- */

router.post('/guest', async (req: Request, res: Response) => {
  try {
    const body = req.body as GuestOrderBody;

    /* ----- 1. Validate ----- */
    if (!body?.customer || typeof body.customer !== 'object') {
      res.status(400).json({ error: 'Missing customer' });
      return;
    }
    const firstName = String(body.customer.firstName || '').trim();
    if (firstName.length < 2 || firstName.length > 60) {
      res.status(400).json({ error: 'Invalid firstName' });
      return;
    }
    const phone = normalizePhone(String(body.customer.phone || ''));
    if (!isValidPhone(phone)) {
      res.status(400).json({ error: 'Invalid phone' });
      return;
    }
    if (body.customer.email && !isValidEmail(body.customer.email)) {
      res.status(400).json({ error: 'Invalid email' });
      return;
    }

    if (!body.delivery || !['delivery', 'pickup'].includes(body.delivery.type)) {
      res.status(400).json({ error: 'Invalid delivery type' });
      return;
    }
    if (body.delivery.type === 'delivery') {
      if (!body.delivery.address?.street || !body.delivery.address?.house) {
        res.status(400).json({ error: 'Address street and house are required for delivery' });
        return;
      }
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }
    for (const item of body.items) {
      if (!item.bouquetId || !Number.isFinite(item.bouquetId)) {
        res.status(400).json({ error: 'Each item needs a bouquetId' });
        return;
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 50) {
        res.status(400).json({ error: 'Invalid item quantity' });
        return;
      }
    }

    /* ----- 2. Recompute prices from DB (never trust client) ----- */
    const ids = body.items.map((i) => i.bouquetId!);
    const bouquets = await prisma.bouquet.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, price: true, inStock: true },
    });
    const byId = new Map(bouquets.map((b) => [b.id, b]));

    const lineItems: Array<{ bouquetId: number; name: string; price: number; quantity: number }> = [];
    let productSubtotal = 0;
    for (const it of body.items) {
      const b = byId.get(it.bouquetId!);
      if (!b) {
        res.status(400).json({ error: `Bouquet ${it.bouquetId} not found` });
        return;
      }
      if (!b.inStock) {
        res.status(400).json({ error: `Bouquet ${b.name} is out of stock` });
        return;
      }
      lineItems.push({
        bouquetId: b.id,
        name: b.name,
        price: b.price,
        quantity: it.quantity,
      });
      productSubtotal += b.price * it.quantity;
    }

    /* ----- 3. Promo + delivery ----- */
    let promoDiscount = 0;
    let validPromoCode: string | null = null;
    if (body.promoCode && typeof body.promoCode === 'string') {
      const code = body.promoCode.trim().toUpperCase();
      if (code === 'VISITKA10') {
        promoDiscount = Math.floor(productSubtotal * 0.1);
        validPromoCode = code;
      }
    }

    const settings = await prisma.setting.findMany({
      where: { key: { in: ['delivery_price', 'free_delivery_from'] } },
    });
    const deliveryPrice = parseInt(
      settings.find((s) => s.key === 'delivery_price')?.value || '500',
      10,
    );
    const freeFrom = parseInt(
      settings.find((s) => s.key === 'free_delivery_from')?.value || '5000',
      10,
    );

    let totalPrice = productSubtotal - promoDiscount;
    if (body.delivery.type === 'delivery' && productSubtotal < freeFrom) {
      totalPrice += deliveryPrice;
    }
    if (totalPrice < 0) totalPrice = 0;

    /* ----- 4. Find or create guest user + address ----- */
    // We can't use phone as a unique key because the schema only has telegramId/maxId
    // unique. So we look up by phone manually and create if missing.
    let user = await prisma.user.findFirst({
      where: { phone, telegramId: null, maxId: null },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          firstName,
          lastName: body.customer.lastName?.trim() || null,
          phone,
          // No telegramId / maxId — this marks the user as a web guest.
        },
      });
    } else {
      // Update name if changed
      if (user.firstName !== firstName) {
        await prisma.user.update({ where: { id: user.id }, data: { firstName } });
      }
    }

    let addressId: number | null = null;
    if (body.delivery.type === 'delivery' && body.delivery.address) {
      const addr = await prisma.address.create({
        data: {
          userId: user.id,
          title: body.delivery.address.city
            ? `${body.delivery.address.city}, ${body.delivery.address.street}`
            : body.delivery.address.street,
          street: body.delivery.address.street,
          house: body.delivery.address.house,
          apartment: body.delivery.address.apartment || null,
          entrance: body.delivery.address.entrance || null,
          floor: body.delivery.address.floor || null,
          comment: body.delivery.address.comment || null,
        },
      });
      addressId = addr.id;
    }

    /* ----- 5. Create order + items in a transaction ----- */
    const commentBody = [
      body.customer.email ? `Email: ${body.customer.email}` : null,
      body.comment ? `Комментарий: ${body.comment}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        addressId,
        status: 'new',
        deliveryType: body.delivery.type,
        deliveryDate: body.delivery.date || null,
        deliveryTime: body.delivery.time || null,
        recipientName: body.recipientName || `${firstName}`,
        recipientPhone: body.recipientPhone || phone,
        comment: commentBody || null,
        totalPrice,
        promoCode: validPromoCode,
        promoDiscount,
        paymentStatus: 'pending',
        isAnonymous: !!body.isAnonymous,
        cardText: body.cardText || null,
        items: { create: lineItems },
      },
      include: { items: true },
    });

    /* ----- 6. Notify admin (best-effort) ----- */
    try {
      const addressLine = body.delivery.address
        ? `${body.delivery.address.street}, ${body.delivery.address.house}${body.delivery.address.apartment ? ', кв. ' + body.delivery.address.apartment : ''}`
        : undefined;
      await notifyAdminNewOrder(
        order.id,
        `${firstName}${body.customer.lastName ? ' ' + body.customer.lastName : ''} · ${phone} · web-shop`,
        totalPrice,
        order.items.reduce((sum, it) => sum + it.quantity, 0),
        body.delivery.type,
        order.items.map((it) => ({ name: it.name, quantity: it.quantity, price: it.price })),
        'web',
        body.delivery.date || undefined,
        body.delivery.time || undefined,
        addressLine,
        body.recipientName || undefined,
        body.recipientPhone || phone,
      );
    } catch (e) {
      console.error('Admin notification failed for guest order:', e);
    }

    /* ----- 7. Respond ----- */
    res.status(201).json({
      orderId: order.id,
      totalPrice,
      productSubtotal,
      deliveryPrice: body.delivery.type === 'delivery' && productSubtotal < freeFrom ? deliveryPrice : 0,
      promoDiscount,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    console.error('Guest order error:', error);
    res.status(500).json({ error: 'Failed to create guest order' });
  }
});

/**
 * GET /api/orders/:id/status — minimal public status check.
 *
 * Used by the web /thank-you page to show "paid" / "pending" / "canceled"
 * after the user returns from YooKassa. Returns only non-sensitive fields.
 *
 * Anyone with an orderId can call this, so we deliberately omit PII (name,
 * phone, address). A guessing attacker can only learn the public status of
 * an arbitrary order — acceptable trade-off for UX.
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        totalPrice: true,
        createdAt: true,
        deliveryType: true,
      },
    });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(order);
  } catch (error) {
    console.error('Guest order status error:', error);
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

export const guestOrderRoutes = router;
