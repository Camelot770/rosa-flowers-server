"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const router = (0, express_1.Router)();
exports.settingsRoutes = router;
const PUBLIC_SETTINGS_KEYS = [
    'studio_name', 'phone', 'email', 'address', 'work_hours',
    'delivery_price', 'free_delivery_from', 'min_order',
    'bonus_percent', 'max_bonus_discount',
    'telegram_link', 'instagram_link',
    'hero_title', 'hero_subtitle', 'hero_description', 'hero_delivery_text',
];
// GET /api/settings — public settings only
router.get('/', async (_req, res) => {
    try {
        const settings = await index_1.prisma.setting.findMany({
            where: { key: { in: PUBLIC_SETTINGS_KEYS } },
        });
        const result = {};
        for (const s of settings) {
            result[s.key] = s.value;
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});
//# sourceMappingURL=settings.js.map