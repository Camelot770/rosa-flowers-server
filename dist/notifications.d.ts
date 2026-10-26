export declare function notifyOrderStatus(userId: number, orderId: number, status: string): Promise<void>;
export declare function notifyOrderCreated(userId: number, orderId: number, totalPrice: number, itemCount: number, deliveryType: string, bonusEarned: number): Promise<void>;
export interface OrderItemInfo {
    name: string;
    price: number;
    quantity: number;
}
export declare function notifyPaymentSuccess(userId: number, orderId: number, totalPrice: number, bonusEarned: number, items?: OrderItemInfo[], deliveryType?: string, deliveryDate?: string, deliveryTime?: string, address?: string, recipientName?: string): Promise<void>;
export { notifyAdminNewOrder, notifyAdminPayment, notifyAdminContactMessage } from './bot';
export declare function broadcastMessage(message: string): Promise<{
    sent: number;
    failed: number;
}>;
//# sourceMappingURL=notifications.d.ts.map