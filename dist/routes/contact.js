"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactRoutes = void 0;
const express_1 = require("express");
const messengerAuth_1 = require("../middleware/messengerAuth");
const notifications_1 = require("../notifications");
const router = (0, express_1.Router)();
exports.contactRoutes = router;
// POST /api/contact — send message to admin
router.post('/', messengerAuth_1.messengerAuth, async (req, res) => {
    try {
        const mu = req.messengerUser;
        const { message } = req.body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }
        if (message.length > 2000) {
            res.status(400).json({ error: 'Message too long' });
            return;
        }
        const senderName = mu.firstName + (mu.lastName ? ` ${mu.lastName}` : '') || 'Клиент';
        const senderUsername = mu.username || null;
        const platformLabel = mu.platform === 'telegram' ? 'Telegram' : 'Max';
        await (0, notifications_1.notifyAdminContactMessage)(senderName, senderUsername, `${platformLabel}: ${mu.platformId}`, message.trim());
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error sending contact message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});
//# sourceMappingURL=contact.js.map