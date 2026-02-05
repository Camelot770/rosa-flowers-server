import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Routes
import { bouquetRoutes } from './routes/bouquets';
import { constructorRoutes } from './routes/constructor';
import { orderRoutes } from './routes/orders';
import { userRoutes } from './routes/user';
import { favoriteRoutes } from './routes/favorites';
import { adminAuthRoutes } from './routes/adminAuth';
import { adminBouquetRoutes } from './routes/adminBouquets';
import { adminConstructorRoutes } from './routes/adminConstructor';
import { adminOrderRoutes } from './routes/adminOrders';
import { adminAnalyticsRoutes } from './routes/adminAnalytics';
import { adminLoyaltyRoutes } from './routes/adminLoyalty';
import { adminSettingsRoutes } from './routes/adminSettings';
import { settingsRoutes } from './routes/settings';
import { paymentRoutes } from './routes/payment';

// Bot
import { startBot } from './bot';

export const prisma = new PrismaClient();
const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// Middleware
app.use(cors({
  origin: [
    process.env.WEBAPP_URL || 'http://localhost:5173',
    process.env.ADMIN_WEBAPP_URL || 'http://localhost:5174',
  ],
  credentials: true,
}));

// Payment webhook needs raw body
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Static files — uploads
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Static files — public (seed images)
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/bouquets', bouquetRoutes);
app.use('/api/constructor', constructorRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/payment', paymentRoutes);

// Telegram-auth routes
app.use('/api/user', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/favorites', favoriteRoutes);

// Admin routes
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/bouquets', adminBouquetRoutes);
app.use('/api/admin/constructor', adminConstructorRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/loyalty', adminLoyaltyRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌹 Rosa Flowers server running on port ${PORT}`);
  startBot().catch(err => console.error('Bot startup failed:', err));
});
