"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.constructorRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const router = (0, express_1.Router)();
exports.constructorRoutes = router;
// GET /api/constructor — все элементы конструктора
router.get('/', async (_req, res) => {
    try {
        const [flowers, greenery, packaging] = await Promise.all([
            index_1.prisma.flower.findMany({ where: { inStock: true } }),
            index_1.prisma.greenery.findMany({ where: { inStock: true } }),
            index_1.prisma.packaging.findMany({ where: { inStock: true } }),
        ]);
        res.json({ flowers, greenery, packaging });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch constructor items' });
    }
});
//# sourceMappingURL=constructor.js.map