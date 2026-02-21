import { v4 as uuidv4 } from 'uuid';

interface PaymentItem {
  name: string;
  price: number;
  quantity: number;
}

interface PaymentResult {
  id: string;
  confirmationUrl: string;
}

export async function createPayment(
  amount: number,
  orderId: number,
  description: string,
  items: PaymentItem[],
  customerEmail?: string,
  returnUrl?: string,
): Promise<PaymentResult> {
  const shopId = process.env.YUKASSA_SHOP_ID;
  const secretKey = process.env.YUKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    throw new Error('YuKassa credentials not configured');
  }

  const idempotenceKey = uuidv4();

  // Формируем позиции чека
  const receiptItems = items.map((item) => ({
    description: item.name.substring(0, 128),
    quantity: String(item.quantity),
    amount: {
      value: item.price.toFixed(2),
      currency: 'RUB',
    },
    vat_code: 1, // Без НДС
    payment_subject: 'commodity',
    payment_mode: 'full_payment',
  }));

  const receipt: any = {
    items: receiptItems,
  };

  // ЮKassa требует email или phone в чеке
  if (customerEmail) {
    receipt.customer = { email: customerEmail };
  } else {
    receipt.customer = { email: 'rozacvetov@list.ru' };
  }

  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': idempotenceKey,
      'Authorization': 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
    },
    body: JSON.stringify({
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB',
      },
      confirmation: {
        type: 'redirect',
        return_url: returnUrl || process.env.YUKASSA_RETURN_URL || `${process.env.WEBAPP_URL}/orders`,
      },
      capture: true,
      description,
      receipt,
      metadata: {
        orderId: orderId.toString(),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('YuKassa API error:', error);
    throw new Error(`YuKassa API error: ${error}`);
  }

  const data: any = await response.json();

  return {
    id: data.id,
    confirmationUrl: data.confirmation.confirmation_url,
  };
}
