import { PaymentItem } from './yukassa';

interface ReceiptOrder {
  totalPrice: number;
  promoDiscount: number;
  bonusUsed: number;
  items: { name: string; price: number; quantity: number }[];
}

// YooKassa rejects a payment unless the receipt lines add up to the amount exactly.
// Promo and bonus discounts are spread over the bouquets in kopecks; delivery stays at full price.
export function buildReceiptItems(order: ReceiptOrder): PaymentItem[] {
  const itemsTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const delivery = Math.max(0, order.totalPrice - itemsTotal + order.promoDiscount + order.bonusUsed);
  const payableKop = (order.totalPrice - delivery) * 100;

  // Largest remainder: floor every line, then hand out the leftover kopecks
  const shares = order.items.map((item, index) => {
    const exact = item.price * item.quantity * payableKop;
    return {
      index,
      kop: itemsTotal > 0 ? Math.floor(exact / itemsTotal) : 0,
      remainder: itemsTotal > 0 ? exact % itemsTotal : 0,
    };
  });
  let leftover = payableKop - shares.reduce((sum, share) => sum + share.kop, 0);
  for (const share of [...shares].sort((a, b) => b.remainder - a.remainder)) {
    if (leftover <= 0) break;
    share.kop += 1;
    leftover -= 1;
  }

  const lines: PaymentItem[] = [];
  order.items.forEach((item, index) => {
    const lineKop = shares[index].kop;
    const unitKop = Math.floor(lineKop / item.quantity);
    const extraUnits = lineKop - unitKop * item.quantity;

    // A line total that does not divide evenly becomes two lines one kopeck apart
    if (item.quantity - extraUnits > 0 && unitKop > 0) {
      lines.push({ name: item.name, price: unitKop / 100, quantity: item.quantity - extraUnits });
    }
    if (extraUnits > 0) {
      lines.push({ name: item.name, price: (unitKop + 1) / 100, quantity: extraUnits });
    }
  });

  if (delivery > 0) {
    lines.push({ name: 'Доставка', price: delivery, quantity: 1, isService: true });
  }

  const receiptKop = lines.reduce((sum, line) => sum + Math.round(line.price * 100) * line.quantity, 0);
  if (receiptKop !== order.totalPrice * 100) {
    throw new Error(`Receipt sum ${receiptKop} differs from order total ${order.totalPrice * 100}`);
  }

  return lines;
}
