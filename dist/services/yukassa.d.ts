interface PaymentItem {
    name: string;
    price: number;
    quantity: number;
}
interface PaymentResult {
    id: string;
    confirmationUrl: string;
}
export declare function createPayment(amount: number, orderId: number, description: string, items: PaymentItem[], customerEmail?: string, returnUrl?: string): Promise<PaymentResult>;
export {};
//# sourceMappingURL=yukassa.d.ts.map