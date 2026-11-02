/**
 * Guest checkout routes for the rosa-cvetov web shop (no Telegram/Max auth).
 *
 * The existing /api/orders flow requires `messengerAuth` because users
 * arrive from a Mini App with a verified platformId. Visitors of
 * розацветов.рф don't have that — they fill in a form, the studio calls
 * back, and (in M4) pay via YooKassa.
 *
 * Strategy:
 *   1. Validate the cart and recompute totals from DB prices.
 *   2. Find or create a guest User by phone (no telegramId, no maxId).
 *      Phone is normalized to E.164-ish "+7XXXXXXXXXX".
 *   3. Optionally create an Address linked to that user.
 *   4. Create the Order with paymentStatus="pending" (no payment yet —
 *      M4 will add /api/payment/create-guest).
 *   5. Notify admin (Telegram) via the existing notifyAdminNewOrder.
 *
 * Mount in src/index.ts:
 *
 *     import { guestOrderRoutes } from './routes/guestOrders';
 *     app.use('/api/orders', guestOrderRoutes);  // adds POST /api/orders/guest
 *
 * The order is fine after the existing `app.use('/api/orders', orderRoutes)`
 * — Express keeps trying matchers until one handles the request, and the
 * existing router doesn't define POST /guest.
 */
export declare const guestOrderRoutes: import("express-serve-static-core").Router;
//# sourceMappingURL=guestOrders.d.ts.map