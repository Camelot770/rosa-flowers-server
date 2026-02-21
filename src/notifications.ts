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
export async function notifyOrderStatus(userId: number, orderId: number, status: string) {
  const user = await getUserPlatformInfo(userId);
  if (!user) return;

  if (user.telegramId) {
    try {
      await telegramBot.notifyOrderStatus(user.telegramId, orderId, status);
    } catch (e) {
      console.error('Failed to notify via Telegram (order status):', e);
    }
  }

  if (user.maxId) {
    try {
      await maxBotModule.maxNotifyOrderStatus(user.maxId, orderId, status);
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
export { notifyAdminNewOrder, notifyAdminPayment, notifyAdminContactMessage } from './bot';

// Broadcast to all users on both platforms
export async function broadcastMessage(message: string): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
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
