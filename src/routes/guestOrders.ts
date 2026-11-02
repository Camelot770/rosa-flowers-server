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
 *   4. Create the Order with paymentStatus="pending" and a random guestToken
 *      that /api/payment/create-guest requires.
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
 *
 * Error messages of this route are shown to site visitors as they are.
 */

import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { notifyAdminNewOrder } from '../notifications';
import { applyPromo, assertMinOrder, cleanText, getOrderSettings, OrderError, priceItems } from '../services/orderPricing';
import { syncOrderPayment } from '../services/payments';

const router = Router();

/* ----------------------------- helpers ----------------------------- */

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
  // Names/prices are recomputed from DB; the client value is ignored.
  items: unknown;
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
      throw new OrderError('Укажите контактные данные');
    }
    const firstName = String(body.customer.firstName || '').trim();
    if (firstName.length < 2 || firstName.length > 60) {
      throw new OrderError('Укажите имя, от 2 до 60 символов');
    }
    const phone = normalizePhone(String(body.customer.phone || ''));
    if (!isValidPhone(phone)) {
      throw new OrderError('Проверьте номер телефона');
    }
    const email = cleanText(body.customer.email, 254);
    if (email && !isValidEmail(email)) {
      throw new OrderError('Проверьте адрес электронной почты');
    }

    if (!body.delivery || !['delivery', 'pickup'].includes(body.delivery.type)) {
      throw new OrderError('Выберите способ получения');
    }
    const street = cleanText(body.delivery.address?.street, 200);
    const house = cleanText(body.delivery.address?.house, 50);
    if (body.delivery.type === 'delivery' && (!street || !house)) {
      throw new OrderError('Укажите улицу и дом для доставки');
    }

    /* ----- 2. Recompute prices from DB (never trust client) ----- */
    const { lines: lineItems, subtotal: productSubtotal } = await priceItems(body.items);

    /* ----- 3. Promo + delivery ----- */
    const settings = await getOrderSettings();
    assertMinOrder(productSubtotal, settings.minOrder);

    const { promoCode: validPromoCode, promoDiscount } = applyPromo(body.promoCode, productSubtotal);

    let totalPrice = productSubtotal - promoDiscount;
    const deliveryPrice =
      body.delivery.type === 'delivery' && productSubtotal < settings.freeDeliveryFrom
        ? settings.deliveryPrice
        : 0;
    totalPrice += deliveryPrice;

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
          lastName: cleanText(body.customer.lastName, 60),
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
    let addressLine: string | undefined;
    if (body.delivery.type === 'delivery' && street && house) {
      const city = cleanText(body.delivery.address?.city, 100);
      const apartment = cleanText(body.delivery.address?.apartment, 20);
      const addr = await prisma.address.create({
        data: {
          userId: user.id,
          title: city ? `${city}, ${street}` : street,
          street,
          house,
          apartment,
          entrance: cleanText(body.delivery.address?.entrance, 20),
          floor: cleanText(body.delivery.address?.floor, 20),
          comment: cleanText(body.delivery.address?.comment, 500),
        },
      });
      addressId = addr.id;
      addressLine = `${city ? city + ', ' : ''}${street}, ${house}${apartment ? ', кв. ' + apartment : ''}`;
    }

    /* ----- 5. Create order + items in a transaction ----- */
    const customerComment = cleanText(body.comment, 1000);
    const commentBody = [
      email ? `Email: ${email}` : null,
      customerComment ? `Комментарий: ${customerComment}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const recipientName = cleanText(body.recipientName, 100);
    const recipientPhone = cleanText(body.recipientPhone, 32);

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        addressId,
        status: 'new',
        deliveryType: body.delivery.type,
        deliveryDate: cleanText(body.delivery.date, 32),
        deliveryTime: cleanText(body.delivery.time, 32),
        recipientName: recipientName || `${firstName}`,
        recipientPhone: recipientPhone || phone,
        comment: commentBody || null,
        totalPrice,
        promoCode: validPromoCode,
        promoDiscount,
        paymentStatus: 'pending',
        guestToken: crypto.randomBytes(16).toString('hex'),
        customerEmail: email,
        isAnonymous: body.isAnonymous === true,
        cardText: cleanText(body.cardText, 1000),
        items: { create: lineItems },
      },
      include: { items: true },
    });

    /* ----- 6. Notify admin (best-effort) ----- */
    try {
      await notifyAdminNewOrder(
        order.id,
        `${firstName}${body.customer.lastName ? ' ' + body.customer.lastName : ''} · ${phone} · web-shop`,
        totalPrice,
        order.items.reduce((sum, it) => sum + it.quantity, 0),
        body.delivery.type,
        order.items.map((it) => ({ name: it.name, quantity: it.quantity, price: it.price })),
        'web',
        order.deliveryDate || undefined,
        order.deliveryTime || undefined,
        addressLine,
        recipientName || undefined,
        recipientPhone || phone,
      );
    } catch (e) {
      console.error('Admin notification failed for guest order:', e);
    }

    /* ----- 7. Respond ----- */
    res.status(201).json({
      orderId: order.id,
      guestToken: order.guestToken,
      totalPrice,
      productSubtotal,
      deliveryPrice,
      promoDiscount,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    if (error instanceof OrderError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Guest order error:', error);
    res.status(500).json({ error: 'Не удалось создать заказ. Попробуйте ещё раз или позвоните нам.' });
  }
});

/**
 * GET /api/orders/:id/status — minimal public status check.
 *
 * Used by the web /thank-you page and the mini-apps' /paid page to show
 * "paid" / "pending" / "canceled" after the user returns from YooKassa.
 * Returns only non-sensitive fields.
 *
 * Anyone with an orderId can call this, so we deliberately omit PII (name,
 * phone, address). A guessing attacker can only learn the public status of
 * an arbitrary order — acceptable trade-off for UX.
 */
const STATUS_FIELDS = {
  id: true,
  status: true,
  paymentStatus: true,
  totalPrice: true,
  createdAt: true,
  deliveryType: true,
} as const;

router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    const current = await prisma.order.findUnique({
      where: { id },
      select: { id: true, paymentId: true, paymentStatus: true },
    });
    if (!current) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    await syncOrderPayment(current);

    res.json(await prisma.order.findUnique({ where: { id }, select: STATUS_FIELDS }));
  } catch (error) {
    console.error('Guest order status error:', error);
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

export const guestOrderRoutes = router;
