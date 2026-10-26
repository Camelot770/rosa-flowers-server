export declare function startBot(): Promise<void>;
export declare function notifyOrderStatus(telegramId: string, orderId: number, status: string): Promise<void>;
export declare function notifyOrderCreated(telegramId: string, orderId: number, totalPrice: number, itemCount: number, deliveryType: string, bonusEarned: number): Promise<void>;
interface OrderItemInfo {
    name: string;
    price: number;
    quantity: number;
}
export declare function notifyPaymentSuccess(telegramId: string, orderId: number, totalPrice: number, bonusEarned: number, items?: OrderItemInfo[], deliveryType?: string, deliveryDate?: string, deliveryTime?: string, address?: string, recipientName?: string): Promise<void>;
export declare function notifyAdminNewOrder(orderId: number, customerName: string, totalPrice: number, itemCount: number, deliveryType: string, items: {
    name: string;
    quantity: number;
    price: number;
}[], platform?: string, deliveryDate?: string, deliveryTime?: string, address?: string, recipientName?: string, recipientPhone?: string, bonusUsed?: number, bonusEarned?: number): Promise<void>;
export declare function notifyAdminPayment(orderId: number, totalPrice: number, items?: OrderItemInfo[], deliveryType?: string, deliveryDate?: string, deliveryTime?: string, address?: string, recipientName?: string, customerName?: string, platform?: string, bonusEarned?: number, recipientPhone?: string, bonusUsed?: number): Promise<void>;
export declare function notifyAdminContactMessage(senderName: string, senderUsername: string | null, platformId: string, message: string): Promise<void>;
export declare function broadcastMessage(telegramIds: string[], message: string): Promise<{
    sent: number;
    failed: number;
}>;
export {};
//# sourceMappingURL=bot.d.ts.map