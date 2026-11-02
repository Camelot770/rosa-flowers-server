/**
 * Guest payment route for the rosa-cvetov web shop.
 *
 * Mirrors the messenger-authed `POST /api/payment/create` (see
 * `src/routes/payment.ts`) but without the user ownership check, since
 * web visitors have no platform identity. The protection here is:
 *
 *   - Order must exist
 *   - Order must belong to a "guest" user (telegramId/maxId both null)
 *   - Order must be in `paymentStatus = 'pending'`
 *   - Order must not have a paymentId yet
 *   - Order must be < 24h old (cheap rate-limit against orderId-guessing)
 *
 * The webhook (`POST /api/payment/webhook`) already handles paid-state
 * transitions correctly for guest orders — `notifyPaymentSuccess` skips
 * its Telegram/Max blocks when both platform IDs are null, but
 * `notifyAdminPayment` still fires.
 *
 * Mount in src/index.ts (next to the existing payment route):
 *
 *   import { guestPaymentRoutes } from './routes/guestPayment';
 *   app.use('/api/payment', guestPaymentRoutes); // adds POST /api/payment/create-guest
 */
export declare const guestPaymentRoutes: import("express-serve-static-core").Router;
//# sourceMappingURL=guestPayment.d.ts.map