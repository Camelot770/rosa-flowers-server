"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminBroadcastRoutes = void 0;
const express_1 = require("express");
const adminAuth_1 = require("../middleware/adminAuth");
const notifications_1 = require("../notifications");
const router = (0, express_1.Router)();
exports.adminBroadcastRoutes = router;
router.use(adminAuth_1.adminAuth);
// POST /api/admin/broadcast — send message to all users (both Telegram and Max)
router.post('/', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }
        if (message.length > 4000) {
            res.status(400).json({ error: 'Message too long (max 4000)' });
            return;
        }
        const result = await (0, notifications_1.broadcastMessage)(message.trim());
        res.json({ ...result, total: result.sent + result.failed });
    }
    catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ error: 'Failed to send broadcast' });
    }
});
//# sourceMappingURL=adminBroadcast.js.map