"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bouquetRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const router = (0, express_1.Router)();
exports.bouquetRoutes = router;
// Helper: parse tags from JSON string to array
function parseTags(bouquet) {
    try {
        bouquet.tags = typeof bouquet.tags === 'string' ? JSON.parse(bouquet.tags) : bouquet.tags;
    }
    catch {
        bouquet.tags = [];
    }
    return bouquet;
}
// GET /api/bouquets — список всех букетов
router.get('/', async (req, res) => {
    try {
        const { category, search, sort, isHit, isNew, priceMin, priceMax } = req.query;
        const where = { inStock: true };
        if (category && category !== 'all') {
            where.category = category;
        }
        if (priceMin || priceMax) {
            where.price = {};
            if (priceMin)
                where.price.gte = parseInt(priceMin);
            if (priceMax)
                where.price.lte = parseInt(priceMax);
        }
        if (isHit === 'true') {
            where.isHit = true;
        }
        if (isNew === 'true') {
            where.isNew = true;
        }
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { description: { contains: search } },
            ];
        }
        let orderBy = { sortOrder: 'asc' };
        if (sort === 'price_asc')
            orderBy = { price: 'asc' };
        if (sort === 'price_desc')
            orderBy = { price: 'desc' };
        if (sort === 'new')
            orderBy = { createdAt: 'desc' };
        const bouquets = await index_1.prisma.bouquet.findMany({
            where,
            orderBy,
            include: { images: { orderBy: { sortOrder: 'asc' } } },
        });
        res.json(bouquets.map(parseTags));
    }
    catch (error) {
        console.error('Error fetching bouquets:', error);
        res.status(500).json({ error: 'Failed to fetch bouquets' });
    }
});
// GET /api/bouquets/categories
router.get('/categories', async (_req, res) => {
    try {
        const categories = await index_1.prisma.bouquet.findMany({
            where: { inStock: true },
            select: { category: true },
            distinct: ['category'],
        });
        res.json(categories.map((c) => c.category));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});
// GET /api/bouquets/:id — один букет
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid bouquet ID' });
            return;
        }
        const bouquet = await index_1.prisma.bouquet.findUnique({
            where: { id },
            include: { images: { orderBy: { sortOrder: 'asc' } } },
        });
        if (!bouquet) {
            res.status(404).json({ error: 'Bouquet not found' });
            return;
        }
        res.json(parseTags(bouquet));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch bouquet' });
    }
});
//# sourceMappingURL=bouquets.js.map