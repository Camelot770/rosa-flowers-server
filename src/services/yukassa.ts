import { v4 as uuidv4 } from 'uuid';

interface PaymentResult {
  id: string;
  confirmationUrl: string;
}

export async function createPayment(amount: number, orderId: number, description: string): Promise<PaymentResult> {
  const shopId = process.env.YUKASSA_SHOP_ID;
  const secretKey = process.env.YUKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    throw new Error('YuKassa credentials not configured');
  }

  const idempotenceKey = uuidv4();

  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': idempotenceKey,
      'Authorization': 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
    },
    body: JSON.stringify({
      amount: {
        value: (amount / 100 * 100).toFixed(2), // amount is in rubles
        currency: 'RUB',
      },
      confirmation: {
        type: 'redirect',
        return_url: process.env.YUKASSA_RETURN_URL || `${process.env.WEBAPP_URL}/orders`,
      },
      capture: true,
      description,
      metadata: {
        orderId: orderId.toString(),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`YuKassa API error: ${error}`);
  }

  const data: any = await response.json();

  return {
    id: data.id,
    confirmationUrl: data.confirmation.confirmation_url,
  };
}

export async function handleWebhook(body: any) {
  // Webhook handling is done in the payment route
  return body;
}
