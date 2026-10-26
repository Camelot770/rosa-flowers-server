"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyAdminContactMessage = exports.notifyAdminPayment = exports.notifyAdminNewOrder = void 0;
exports.notifyOrderStatus = notifyOrderStatus;
exports.notifyOrderCreated = notifyOrderCreated;
exports.notifyPaymentSuccess = notifyPaymentSuccess;
exports.broadcastMessage = broadcastMessage;
const index_1 = require("./index");
const telegramBot = __importStar(require("./bot"));
const maxBotModule = __importStar(require("./maxBot"));
// Helper: get platform IDs for a user
async function getUserPlatformInfo(userId) {
    return index_1.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true, maxId: true },
    });
}
// Notify user about order status change — dispatches to the correct platform(s)
async function notifyOrderStatus(userId, orderId, status) {
    const user = await getUserPlatformInfo(userId);
    if (!user)
        return;
    if (user.telegramId) {
        try {
            await telegramBot.notifyOrderStatus(user.telegramId, orderId, status);
        }
        catch (e) {
            console.error('Failed to notify via Telegram (order status):', e);
        }
    }
    if (user.maxId) {
        try {
            await maxBotModule.maxNotifyOrderStatus(user.maxId, orderId, status);
        }
        catch (e) {
            console.error('Failed to notify via Max (order status):', e);
        }
    }
}
// Notify user about order creation
async function notifyOrderCreated(userId, orderId, totalPrice, itemCount, deliveryType, bonusEarned) {
    const user = await getUserPlatformInfo(userId);
    if (!user)
        return;
    if (user.telegramId) {
        try {
            await telegramBot.notifyOrderCreated(user.telegramId, orderId, totalPrice, itemCount, deliveryType, bonusEarned);
        }
        catch (e) {
            console.error('Failed to notify via Telegram (order created):', e);
        }
    }
    if (user.maxId) {
        try {
            await maxBotModule.maxNotifyOrderCreated(user.maxId, orderId, totalPrice, itemCount, deliveryType, bonusEarned);
        }
        catch (e) {
            console.error('Failed to notify via Max (order created):', e);
        }
    }
}
// Notify user about successful payment with full order details
async function notifyPaymentSuccess(userId, orderId, totalPrice, bonusEarned, items, deliveryType, deliveryDate, deliveryTime, address, recipientName) {
    const user = await getUserPlatformInfo(userId);
    if (!user)
        return;
    if (user.telegramId) {
        try {
            await telegramBot.notifyPaymentSuccess(user.telegramId, orderId, totalPrice, bonusEarned, items, deliveryType, deliveryDate, deliveryTime, address, recipientName);
        }
        catch (e) {
            console.error('Failed to notify via Telegram (payment success):', e);
        }
    }
    if (user.maxId) {
        try {
            await maxBotModule.maxNotifyPaymentSuccess(user.maxId, orderId, totalPrice, bonusEarned, items, deliveryType, deliveryDate, deliveryTime, address, recipientName);
        }
        catch (e) {
            console.error('Failed to notify via Max (payment success):', e);
        }
    }
}
// Admin notifications go to Telegram only (admin uses Telegram)
var bot_1 = require("./bot");
Object.defineProperty(exports, "notifyAdminNewOrder", { enumerable: true, get: function () { return bot_1.notifyAdminNewOrder; } });
Object.defineProperty(exports, "notifyAdminPayment", { enumerable: true, get: function () { return bot_1.notifyAdminPayment; } });
Object.defineProperty(exports, "notifyAdminContactMessage", { enumerable: true, get: function () { return bot_1.notifyAdminContactMessage; } });
// Broadcast to all users on both platforms
async function broadcastMessage(message) {
    const users = await index_1.prisma.user.findMany({
        select: { telegramId: true, maxId: true },
    });
    const telegramIds = users.filter((u) => u.telegramId).map((u) => u.telegramId);
    const maxIds = users.filter((u) => u.maxId).map((u) => u.maxId);
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
//# sourceMappingURL=notifications.js.map