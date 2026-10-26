import { prisma } from '../index';

export async function earnBonus(userId: number, amount: number, orderId: number) {
  await prisma.user.update({
    where: { id: userId },
    data: { bonusPoints: { increment: amount } },
  });

  await prisma.loyaltyHistory.create({
    data: {
      userId,
      amount,
      type: 'earn',
      description: `Кэшбэк за заказ #${orderId}`,
      orderId,
    },
  });
}

export async function spendBonus(userId: number, amount: number, orderId: number) {
  await prisma.user.update({
    where: { id: userId },
    data: { bonusPoints: { decrement: amount } },
  });

  await prisma.loyaltyHistory.create({
    data: {
      userId,
      amount: -amount,
      type: 'spend',
      description: `Списание за заказ #${orderId}`,
      orderId,
    },
  });
}
