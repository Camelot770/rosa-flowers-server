import { Prisma } from '@prisma/client';
import { prisma } from './index';
import * as telegramBot from './bot';
import * as maxBotModule from './maxBot';

// Helper: get platform IDs for a user
async function getUserPlatformInfo(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true, maxId: true },
  });
}

// Notify user about order status change — dispatches to the correct platform(s)
export async function notifyOrderStatus(userId: number, orderId: number, status: string, deliveryType?: string) {
  const user = await getUserPlatformInfo(userId);
  if (!user) return;

  if (user.telegramId) {
    try {
      await telegramBot.notifyOrderStatus(user.telegramId, orderId, status, deliveryType);
    } catch (e) {
      console.error('Failed to notify via Telegram (order status):', e);
    }
  }

  if (user.maxId) {
    try {
      await maxBotModule.maxNotifyOrderStatus(user.maxId, orderId, status, deliveryType);
    } catch (e) {
      console.error('Failed to notify via Max (order status):', e);
    }
  }
}

// Notify user about order creation
export async function notifyOrderCreated(
  userId: number,
  orderId: number,
  totalPrice: number,
  itemCount: number,
  deliveryType: string,
  bonusEarned: number,
) {
  const user = await getUserPlatformInfo(userId);
  if (!user) return;

  if (user.telegramId) {
    try {
      await telegramBot.notifyOrderCreated(user.telegramId, orderId, totalPrice, itemCount, deliveryType, bonusEarned);
    } catch (e) {
      console.error('Failed to notify via Telegram (order created):', e);
    }
  }

  if (user.maxId) {
    try {
      await maxBotModule.maxNotifyOrderCreated(user.maxId, orderId, totalPrice, itemCount, deliveryType, bonusEarned);
    } catch (e) {
      console.error('Failed to notify via Max (order created):', e);
    }
  }
}

// Order item info for detailed notifications
export interface OrderItemInfo {
  name: string;
  price: number;
  quantity: number;
}

// Notify user about successful payment with full order details
export async function notifyPaymentSuccess(
  userId: number,
  orderId: number,
  totalPrice: number,
  bonusEarned: number,
  items?: OrderItemInfo[],
  deliveryType?: string,
  deliveryDate?: string,
  deliveryTime?: string,
  address?: string,
  recipientName?: string,
) {
  const user = await getUserPlatformInfo(userId);
  if (!user) return;

  if (user.telegramId) {
    try {
      await telegramBot.notifyPaymentSuccess(user.telegramId, orderId, totalPrice, bonusEarned, items, deliveryType, deliveryDate, deliveryTime, address, recipientName);
    } catch (e) {
      console.error('Failed to notify via Telegram (payment success):', e);
    }
  }

  if (user.maxId) {
    try {
      await maxBotModule.maxNotifyPaymentSuccess(user.maxId, orderId, totalPrice, bonusEarned, items, deliveryType, deliveryDate, deliveryTime, address, recipientName);
    } catch (e) {
      console.error('Failed to notify via Max (payment success):', e);
    }
  }
}

// Admin notifications go to Telegram only (admin uses Telegram)
export { notifyAdminNewOrder, notifyAdminPayment, notifyAdminContactMessage, notifyAdminAlert } from './bot';

export const BROADCAST_AUDIENCES = ['all', 'telegram', 'max', 'buyers'] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

const AUDIENCE_FILTERS: Record<BroadcastAudience, Prisma.UserWhereInput> = {
  all: { OR: [{ telegramId: { not: null } }, { maxId: { not: null } }] },
  telegram: { telegramId: { not: null } },
  max: { maxId: { not: null } },
  buyers: {
    OR: [{ telegramId: { not: null } }, { maxId: { not: null } }],
    orders: { some: { paymentStatus: 'paid', status: { not: 'canceled' } } },
  },
};

export async function broadcastAudienceCounts() {
  const [all, telegram, max, buyers] = await Promise.all(
    BROADCAST_AUDIENCES.map((audience) => prisma.user.count({ where: AUDIENCE_FILTERS[audience] })),
  );
  return { all, telegram, max, buyers };
}

// A message to one customer through the bot they use
export async function messageUser(user: { telegramId: string | null; maxId: string | null }, message: string): Promise<boolean> {
  const tg = user.telegramId ? await telegramBot.broadcastMessage([user.telegramId], message) : { sent: 0 };
  const max = user.maxId ? await maxBotModule.maxBroadcastMessage([user.maxId], message) : { sent: 0 };
  return tg.sent + max.sent > 0;
}

export async function sendTestToAdmins(message: string): Promise<{ sent: number; failed: number }> {
  return telegramBot.broadcastMessage(telegramBot.adminIds(), message);
}

// Broadcast on both platforms
export async function broadcastMessage(message: string, audience: BroadcastAudience = 'all'): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: AUDIENCE_FILTERS[audience],
    select: { telegramId: true, maxId: true },
  });

  const telegramIds = users.filter((u) => u.telegramId).map((u) => u.telegramId!);
  const maxIds = users.filter((u) => u.maxId).map((u) => u.maxId!);

  const tgResult = telegramIds.length > 0
    ? await telegramBot.broadcastMessage(telegramIds, message)
    : { sent: 0, failed: 0 };

  const maxResult = maxIds.length > 0
    ? await maxBotModule.maxBroadcastMessage(maxIds, message)
    : { sent: 0, failed: 0 };

  return {
    sent: tgResult.sent + maxResult.sent,
    failed: tgResult.failed + maxResult.failed,
  };
}
