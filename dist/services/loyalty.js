"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.earnBonus = earnBonus;
exports.spendBonus = spendBonus;
const index_1 = require("../index");
async function earnBonus(userId, amount, orderId) {
    await index_1.prisma.user.update({
        where: { id: userId },
        data: { bonusPoints: { increment: amount } },
    });
    await index_1.prisma.loyaltyHistory.create({
        data: {
            userId,
            amount,
            type: 'earn',
            description: `Кэшбэк за заказ #${orderId}`,
            orderId,
        },
    });
}
async function spendBonus(userId, amount, orderId) {
    await index_1.prisma.user.update({
        where: { id: userId },
        data: { bonusPoints: { decrement: amount } },
    });
    await index_1.prisma.loyaltyHistory.create({
        data: {
            userId,
            amount: -amount,
            type: 'spend',
            description: `Списание за заказ #${orderId}`,
            orderId,
        },
    });
}
//# sourceMappingURL=loyalty.js.map