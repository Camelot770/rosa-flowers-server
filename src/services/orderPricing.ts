import { prisma } from '../index';

const MAX_QUANTITY = 50;
const MAX_LINES = 50;

// An order problem whose message is safe to show to the customer
export class OrderError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
  }
}

export interface PricedLine {
  bouquetId: number;
  name: string;
  price: number;
  quantity: number;
}

// Prices always come from the database, client values are ignored
export async function priceItems(rawItems: unknown): Promise<{ lines: PricedLine[]; subtotal: number }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new OrderError('Корзина пуста');
  }
  if (rawItems.length > MAX_LINES) {
    throw new OrderError('Слишком много позиций в заказе');
  }

  for (const item of rawItems) {
    if (!Number.isInteger(item?.bouquetId) || item.isConstructor) {
      throw new OrderError('В корзине есть позиция, которую нельзя заказать. Обновите корзину.');
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      throw new OrderError(`Количество должно быть от 1 до ${MAX_QUANTITY}`);
    }
  }

  const bouquets = await prisma.bouquet.findMany({
    where: { id: { in: rawItems.map((item) => item.bouquetId) } },
    select: { id: true, name: true, price: true, inStock: true, customOrder: true },
  });
  const byId = new Map(bouquets.map((b) => [b.id, b]));

  let subtotal = 0;
  const lines = rawItems.map((item): PricedLine => {
    const bouquet = byId.get(item.bouquetId);
    if (!bouquet) {
      throw new OrderError('Одного из букетов больше нет в каталоге. Обновите корзину.');
    }
    if (!bouquet.inStock && !bouquet.customOrder) {
      throw new OrderError(`Букет «${bouquet.name}» сейчас недоступен. Уберите его из корзины.`);
    }
    subtotal += bouquet.price * item.quantity;
    return { bouquetId: bouquet.id, name: bouquet.name, price: bouquet.price, quantity: item.quantity };
  });

  return { lines, subtotal };
}

export async function getOrderSettings() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['delivery_price', 'free_delivery_from', 'min_order', 'bonus_percent', 'max_bonus_discount'] } },
  });
  const value = (key: string, fallback: number) => {
    const parsed = parseInt(rows.find((s) => s.key === key)?.value ?? '');
    return isNaN(parsed) ? fallback : parsed;
  };

  return {
    deliveryPrice: value('delivery_price', 500),
    freeDeliveryFrom: value('free_delivery_from', 5000),
    minOrder: value('min_order', 0),
    bonusPercent: value('bonus_percent', 5),
    maxBonusPercent: value('max_bonus_discount', 20),
  };
}

export function assertMinOrder(subtotal: number, minOrder: number): void {
  if (subtotal < minOrder) {
    throw new OrderError(`Минимальная сумма заказа ${minOrder.toLocaleString('ru-RU')} ₽`);
  }
}

// Promo code validation (server-side)
export function applyPromo(promoCode: unknown, subtotal: number): { promoCode: string | null; promoDiscount: number } {
  if (typeof promoCode === 'string' && promoCode.trim().toUpperCase() === 'VISITKA10') {
    return { promoCode: 'VISITKA10', promoDiscount: Math.floor(subtotal * 0.1) }; // 10% off
  }
  return { promoCode: null, promoDiscount: 0 };
}

// Trimmed string limited in length, or null when empty or not a string
export function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().slice(0, maxLength);
  return text || null;
}
