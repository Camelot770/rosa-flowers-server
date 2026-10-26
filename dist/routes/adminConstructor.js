"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminConstructorRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const adminAuth_1 = require("../middleware/adminAuth");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
exports.adminConstructorRoutes = router;
router.use(adminAuth_1.adminAuth);
// GET /api/admin/constructor — все элементы конструктора
router.get('/', async (_req, res) => {
    try {
        const [flowers, greenery, packaging] = await Promise.all([
            index_1.prisma.flower.findMany(),
            index_1.prisma.greenery.findMany(),
            index_1.prisma.packaging.findMany(),
        ]);
        res.json({ flowers, greenery, packaging });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch constructor items' });
    }
});
// POST /api/admin/constructor/flowers
router.post('/flowers', upload_1.upload.single('image'), async (req, res) => {
    try {
        const { name, price, inStock } = req.body;
        const priceNum = parseInt(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            res.status(400).json({ error: 'Invalid price' });
            return;
        }
        const file = req.file;
        const flower = await index_1.prisma.flower.create({
            data: {
                name,
                price: priceNum,
                imageUrl: file ? `/uploads/${file.filename}` : null,
                inStock: inStock !== 'false',
            },
        });
        res.json(flower);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create flower' });
    }
});
// PUT /api/admin/constructor/flowers/:id
router.put('/flowers/:id', upload_1.upload.single('image'), async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }
        const { name, price, inStock } = req.body;
        const priceNum = parseInt(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            res.status(400).json({ error: 'Invalid price' });
            return;
        }
        const file = req.file;
        const flower = await index_1.prisma.flower.update({
            where: { id },
            data: {
                name,
                price: priceNum,
                ...(file ? { imageUrl: `/uploads/${file.filename}` } : {}),
                inStock: inStock !== 'false',
            },
        });
        res.json(flower);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update flower' });
    }
});
// DELETE /api/admin/constructor/flowers/:id
router.delete('/flowers/:id', async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }
        await index_1.prisma.flower.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete flower' });
    }
});
// POST /api/admin/constructor/greenery
router.post('/greenery', upload_1.upload.single('image'), async (req, res) => {
    try {
        const { name, price, inStock } = req.body;
        const priceNum = parseInt(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            res.status(400).json({ error: 'Invalid price' });
            return;
        }
        const file = req.file;
        const item = await index_1.prisma.greenery.create({
            data: {
                name,
                price: priceNum,
                imageUrl: file ? `/uploads/${file.filename}` : null,
                inStock: inStock !== 'false',
            },
        });
        res.json(item);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create greenery' });
    }
});
// PUT /api/admin/constructor/greenery/:id
router.put('/greenery/:id', upload_1.upload.single('image'), async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }
        const { name, price, inStock } = req.body;
        const priceNum = parseInt(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            res.status(400).json({ error: 'Invalid price' });
            return;
        }
        const file = req.file;
        const item = await index_1.prisma.greenery.update({
            where: { id },
            data: {
                name,
                price: priceNum,
                ...(file ? { imageUrl: `/uploads/${file.filename}` } : {}),
                inStock: inStock !== 'false',
            },
        });
        res.json(item);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update greenery' });
    }
});
// DELETE /api/admin/constructor/greenery/:id
router.delete('/greenery/:id', async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }
        await index_1.prisma.greenery.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete greenery' });
    }
});
// POST /api/admin/constructor/packaging
router.post('/packaging', upload_1.upload.single('image'), async (req, res) => {
    try {
        const { name, price, inStock } = req.body;
        const priceNum = parseInt(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            res.status(400).json({ error: 'Invalid price' });
            return;
        }
        const file = req.file;
        const item = await index_1.prisma.packaging.create({
            data: {
                name,
                price: priceNum,
                imageUrl: file ? `/uploads/${file.filename}` : null,
                inStock: inStock !== 'false',
            },
        });
        res.json(item);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create packaging' });
    }
});
// PUT /api/admin/constructor/packaging/:id
router.put('/packaging/:id', upload_1.upload.single('image'), async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }
        const { name, price, inStock } = req.body;
        const priceNum = parseInt(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            res.status(400).json({ error: 'Invalid price' });
            return;
        }
        const file = req.file;
        const item = await index_1.prisma.packaging.update({
            where: { id },
            data: {
                name,
                price: priceNum,
                ...(file ? { imageUrl: `/uploads/${file.filename}` } : {}),
                inStock: inStock !== 'false',
            },
        });
        res.json(item);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update packaging' });
    }
});
// DELETE /api/admin/constructor/packaging/:id
router.delete('/packaging/:id', async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }
        await index_1.prisma.packaging.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete packaging' });
    }
});
//# sourceMappingURL=adminConstructor.js.map