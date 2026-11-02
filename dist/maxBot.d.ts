import { Bot } from '@maxhub/max-bot-api';
export declare function getMaxBot(): Bot | null;
export declare function startMaxBot(): Promise<void>;
export declare function maxNotifyOrderStatus(maxId: string, orderId: number, status: string): Promise<void>;
export declare function maxNotifyOrderCreated(maxId: string, orderId: number, totalPrice: number, itemCount: number, deliveryType: string, bonusEarned: number): Promise<void>;
interface OrderItemInfo {
    name: string;
    price: number;
    quantity: number;
}
export declare function maxNotifyPaymentSuccess(maxId: string, orderId: number, totalPrice: number, bonusEarned: number, items?: OrderItemInfo[], deliveryType?: string, deliveryDate?: string, deliveryTime?: string, address?: string, recipientName?: string): Promise<void>;
export declare function maxBroadcastMessage(maxIds: string[], message: string): Promise<{
    sent: number;
    failed: number;
}>;
export {};
//# sourceMappingURL=maxBot.d.ts.map