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

// Cancels an order once: spent bonuses go back, and bonuses already earned for a paid order are taken back.
// Returns null when the order was already canceled.
export async function cancelOrderWithRefund(orderId: number) {
  return prisma.$transaction(async (tx) => {
    const canceled = await tx.order.updateMany({
      where: { id: orderId, status: { not: 'canceled' } },
      data: { status: 'canceled' },
    });
    if (canceled.count === 0) return null;

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

    if (order.bonusUsed > 0) {
      await tx.user.update({
        where: { id: order.userId },
        data: { bonusPoints: { increment: order.bonusUsed } },
      });
      await tx.loyaltyHistory.create({
        data: {
          userId: order.userId,
          amount: order.bonusUsed,
          type: 'refund',
          description: `Возврат бонусов за отменённый заказ #${order.id}`,
          orderId: order.id,
        },
      });
    }

    if (order.paymentStatus === 'paid' && order.bonusEarned > 0) {
      const user = await tx.user.findUniqueOrThrow({ where: { id: order.userId }, select: { bonusPoints: true } });
      const revoked = Math.min(order.bonusEarned, user.bonusPoints);
      if (revoked > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: { bonusPoints: { decrement: revoked } },
        });
        await tx.loyaltyHistory.create({
          data: {
            userId: order.userId,
            amount: -revoked,
            type: 'revoke',
            description: `Отмена начисления за заказ #${order.id}`,
            orderId: order.id,
          },
        });
      }
    }

    return order;
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
