"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
// Routes
const bouquets_1 = require("./routes/bouquets");
const constructor_1 = require("./routes/constructor");
const orders_1 = require("./routes/orders");
const user_1 = require("./routes/user");
const favorites_1 = require("./routes/favorites");
const contact_1 = require("./routes/contact");
const adminAuth_1 = require("./routes/adminAuth");
const adminBouquets_1 = require("./routes/adminBouquets");
const adminConstructor_1 = require("./routes/adminConstructor");
const adminOrders_1 = require("./routes/adminOrders");
const adminAnalytics_1 = require("./routes/adminAnalytics");
const adminLoyalty_1 = require("./routes/adminLoyalty");
const adminSettings_1 = require("./routes/adminSettings");
const adminUsers_1 = require("./routes/adminUsers");
const adminBroadcast_1 = require("./routes/adminBroadcast");
const settings_1 = require("./routes/settings");
const payment_1 = require("./routes/payment");
const guestOrders_1 = require("./routes/guestOrders");
const guestPayment_1 = require("./routes/guestPayment");
// Bots
const bot_1 = require("./bot");
const maxBot_1 = require("./maxBot");
// One-time data migrations that run at server boot (idempotent)
const applyBouquetRenames_1 = require("./startup/applyBouquetRenames");
exports.prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '4000', 10);
// Middleware
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
}));
// Payment webhook needs raw body
app.use('/api/payment/webhook', express_1.default.raw({ type: 'application/json' }));
app.use(express_1.default.json());
// Static files — uploads
const uploadsDir = process.env.UPLOADS_DIR || path_1.default.join(__dirname, '..', 'uploads');
app.use('/uploads', express_1.default.static(uploadsDir));
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Public routes
app.use('/api/bouquets', bouquets_1.bouquetRoutes);
app.use('/api/constructor', constructor_1.constructorRoutes);
app.use('/api/settings', settings_1.settingsRoutes);
app.use('/api/payment', payment_1.paymentRoutes);
// Telegram-auth routes
app.use('/api/user', user_1.userRoutes);
app.use('/api/orders', orders_1.orderRoutes);
app.use('/api/favorites', favorites_1.favoriteRoutes);
app.use('/api/contact', contact_1.contactRoutes);
// Web-shop guest routes (no auth — rosa-web frontend)
app.use('/api/orders', guestOrders_1.guestOrderRoutes); // POST /api/orders/guest + GET /api/orders/:id/status
app.use('/api/payment', guestPayment_1.guestPaymentRoutes); // POST /api/payment/create-guest
// Admin routes
app.use('/api/admin/auth', adminAuth_1.adminAuthRoutes);
app.use('/api/admin/bouquets', adminBouquets_1.adminBouquetRoutes);
app.use('/api/admin/constructor', adminConstructor_1.adminConstructorRoutes);
app.use('/api/admin/orders', adminOrders_1.adminOrderRoutes);
app.use('/api/admin/analytics', adminAnalytics_1.adminAnalyticsRoutes);
app.use('/api/admin/loyalty', adminLoyalty_1.adminLoyaltyRoutes);
app.use('/api/admin/settings', adminSettings_1.adminSettingsRoutes);
app.use('/api/admin/users', adminUsers_1.adminUserRoutes);
app.use('/api/admin/broadcast', adminBroadcast_1.adminBroadcastRoutes);
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rosa Flowers server running on port ${PORT}`);
    (0, bot_1.startBot)().catch(err => console.error('Telegram bot startup failed:', err));
    (0, maxBot_1.startMaxBot)().catch(err => console.error('Max bot startup failed:', err));
    (0, applyBouquetRenames_1.applyBouquetRenames)().catch(err => console.error('Bouquet rename startup task failed:', err));
});
// Graceful shutdown
const shutdown = async () => {
    console.log('Shutting down...');
    server.close();
    await exports.prisma.$disconnect();
    process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});
//# sourceMappingURL=index.js.map