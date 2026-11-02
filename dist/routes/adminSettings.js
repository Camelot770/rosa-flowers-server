"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSettingsRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
exports.adminSettingsRoutes = router;
router.use(adminAuth_1.adminAuth);
// GET /api/admin/settings — все настройки
router.get('/', async (_req, res) => {
    try {
        const settings = await index_1.prisma.setting.findMany();
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
// PUT /api/admin/settings — обновить настройки
router.put('/', async (req, res) => {
    try {
        const updates = req.body;
        for (const [key, value] of Object.entries(updates)) {
            await index_1.prisma.setting.upsert({
                where: { key },
                update: { value },
                create: { key, value },
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});
//# sourceMappingURL=adminSettings.js.map