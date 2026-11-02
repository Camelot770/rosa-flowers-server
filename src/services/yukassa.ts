import crypto from 'crypto';

const API_URL = 'https://api.yookassa.ru/v3';
const REQUEST_TIMEOUT_MS = 15000;

export interface PaymentItem {
  name: string;
  price: number;
  quantity: number;
  isService?: boolean;
}

export interface PaymentResult {
  id: string;
  confirmationUrl: string;
}

export interface YooKassaPayment {
  id: string;
  status: string;
  amount: { value: string; currency: string };
  metadata?: { orderId?: string };
  confirmation?: { confirmation_url?: string };
}

function authHeader(): string {
  const shopId = process.env.YUKASSA_SHOP_ID;
  const secretKey = process.env.YUKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    throw new Error('YuKassa credentials not configured');
  }

  return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
}

const RETURN_HOSTS = [
  'rosa-flowers-client.vercel.app',
  'rosa-cvetov-max.vercel.app',
  'rosa-web.vercel.app',
  'rosa-web-naums-projects-5189a309.vercel.app',
  'xn--80aealh5bekx1b.xn--p1ai', // розацветов.рф
  'www.xn--80aealh5bekx1b.xn--p1ai',
];

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Only our own frontends may be used as the page YooKassa redirects to after payment
export function safeReturnUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const url = new URL(raw);
    const allowed = [
      ...RETURN_HOSTS,
      hostOf(process.env.WEBAPP_URL),
      hostOf(process.env.MAX_WEBAPP_URL),
      hostOf(process.env.SITE_URL),
    ];
    return url.protocol === 'https:' && allowed.includes(url.hostname) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function createPayment(
  amount: number,
  orderId: number,
  description: string,
  items: PaymentItem[],
  customerEmail?: string,
  returnUrl?: string,
  previousPaymentId?: string,
): Promise<PaymentResult> {
  const authorization = authHeader();

  // Формируем позиции чека
  const receiptItems = items.map((item) => ({
    description: item.name.substring(0, 128),
    quantity: String(item.quantity),
    amount: {
      value: item.price.toFixed(2),
      currency: 'RUB',
    },
    vat_code: 1, // Без НДС
    payment_subject: item.isService ? 'service' : 'commodity',
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

  const body = JSON.stringify({
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
  });

  // A retried request for the same order returns the same payment instead of charging twice
  const idempotenceKey = crypto
    .createHash('sha256')
    .update(`${orderId}:${previousPaymentId || ''}:${body}`)
    .digest('hex');

  const response = await fetch(`${API_URL}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': idempotenceKey,
      'Authorization': authorization,
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

// Returns null when YooKassa does not know this payment, throws when YooKassa cannot be asked
export async function fetchPayment(
  paymentId: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<YooKassaPayment | null> {
  const response = await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { 'Authorization': authHeader() },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`YuKassa API error: ${response.status}`);
  }

  return (await response.json()) as YooKassaPayment;
}
