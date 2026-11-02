"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminBouquetRoutes = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const index_1 = require("../index");
const adminAuth_1 = require("../middleware/adminAuth");
const upload_1 = require("../middleware/upload");
// Wrapper to handle multer errors gracefully
function handleUpload(fieldName, maxCount) {
    const multerMiddleware = upload_1.upload.array(fieldName, maxCount);
    return (req, res, next) => {
        multerMiddleware(req, res, (err) => {
            if (err instanceof multer_1.default.MulterError) {
                res.status(400).json({ error: `Ошибка загрузки: ${err.message}` });
                return;
            }
            if (err) {
                console.error('Upload error:', err);
                res.status(500).json({ error: 'Ошибка загрузки файлов' });
                return;
            }
            next();
        });
    };
}
const router = (0, express_1.Router)();
exports.adminBouquetRoutes = router;
router.use(adminAuth_1.adminAuth);
function parseTags(bouquet) {
    try {
        bouquet.tags = typeof bouquet.tags === 'string' ? JSON.parse(bouquet.tags) : bouquet.tags;
    }
    catch {
        bouquet.tags = [];
    }
    return bouquet;
}
// GET /api/admin/bouquets — все букеты (включая не в наличии)
router.get('/', async (_req, res) => {
    try {
        const bouquets = await index_1.prisma.bouquet.findMany({
            include: { images: { orderBy: { sortOrder: 'asc' } } },
            orderBy: { sortOrder: 'asc' },
        });
        res.json(bouquets.map(parseTags));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch bouquets' });
    }
});
// GET /api/admin/bouquets/:id — один букет для редактирования
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
// POST /api/admin/bouquets — создать букет
router.post('/', handleUpload('images', 10), async (req, res) => {
    try {
        const { name, description, price, oldPrice, category, tags, inStock, isHit, isNew, customOrder, sortOrder } = req.body;
        const files = req.files;
        const parsedPrice = parseInt(price);
        if (isNaN(parsedPrice) || parsedPrice < 1) {
            res.status(400).json({ error: 'Цена должна быть положительным числом' });
            return;
        }
        const parsedOldPrice = oldPrice ? parseInt(oldPrice) : null;
        if (parsedOldPrice !== null && (isNaN(parsedOldPrice) || parsedOldPrice < 0)) {
            res.status(400).json({ error: 'Старая цена не может быть отрицательной' });
            return;
        }
        const bouquet = await index_1.prisma.bouquet.create({
            data: {
                name,
                description,
                price: parsedPrice,
                oldPrice: parsedOldPrice,
                category: category || 'bouquets',
                tags: tags
                    ? JSON.stringify(tags.split(',').map((t) => t.trim()).filter(Boolean))
                    : '[]',
                inStock: inStock !== 'false',
                isHit: isHit === 'true',
                isNew: isNew === 'true',
                customOrder: customOrder === 'true',
                sortOrder: Math.max(0, parseInt(sortOrder) || 0),
                images: {
                    create: files?.map((f, i) => ({
                        url: `/uploads/${f.filename}`,
                        sortOrder: i,
                    })) || [],
                },
            },
            include: { images: true },
        });
        res.json(parseTags(bouquet));
    }
    catch (error) {
        console.error('Error creating bouquet:', error);
        res.status(500).json({ error: 'Failed to create bouquet' });
    }
});
// PUT /api/admin/bouquets/:id — обновить букет
router.put('/:id', handleUpload('images', 10), async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid bouquet ID' });
            return;
        }
        const { name, description, price, oldPrice, category, tags, inStock, isHit, isNew, customOrder, sortOrder, deleteImages } = req.body;
        const files = req.files;
        const parsedPrice = parseInt(price);
        if (isNaN(parsedPrice) || parsedPrice < 1) {
            res.status(400).json({ error: 'Цена должна быть положительным числом' });
            return;
        }
        const parsedOldPrice = oldPrice ? parseInt(oldPrice) : null;
        if (parsedOldPrice !== null && (isNaN(parsedOldPrice) || parsedOldPrice < 0)) {
            res.status(400).json({ error: 'Старая цена не может быть отрицательной' });
            return;
        }
        // Delete specified images
        if (deleteImages) {
            try {
                const ids = JSON.parse(deleteImages);
                await index_1.prisma.bouquetImage.deleteMany({ where: { id: { in: ids } } });
            }
            catch {
                res.status(400).json({ error: 'Invalid deleteImages format' });
                return;
            }
        }
        const bouquet = await index_1.prisma.bouquet.update({
            where: { id },
            data: {
                name,
                description,
                price: parsedPrice,
                oldPrice: parsedOldPrice,
                category: category || 'bouquets',
                tags: tags
                    ? JSON.stringify(tags.split(',').map((t) => t.trim()).filter(Boolean))
                    : '[]',
                inStock: inStock !== 'false',
                isHit: isHit === 'true',
                isNew: isNew === 'true',
                customOrder: customOrder === 'true',
                sortOrder: Math.max(0, parseInt(sortOrder) || 0),
                images: files?.length ? {
                    create: files.map((f, i) => ({
                        url: `/uploads/${f.filename}`,
                        sortOrder: i + 100,
                    })),
                } : undefined,
            },
            include: { images: { orderBy: { sortOrder: 'asc' } } },
        });
        res.json(parseTags(bouquet));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update bouquet' });
    }
});
// PATCH /api/admin/bouquets/:id/toggle — quick toggle field
router.patch('/:id/toggle', async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid bouquet ID' });
            return;
        }
        const { field, value } = req.body;
        if (!['inStock', 'isHit', 'isNew', 'customOrder'].includes(field) || typeof value !== 'boolean') {
            res.status(400).json({ error: 'Invalid field or value' });
            return;
        }
        const bouquet = await index_1.prisma.bouquet.update({
            where: { id },
            data: { [field]: value },
        });
        res.json({ success: true, [field]: bouquet[field] });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to toggle field' });
    }
});
// DELETE /api/admin/bouquets/:id — удалить букет
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid bouquet ID' });
            return;
        }
        // Remove favorites before deleting (orderItems are unlinked via onDelete: SetNull, images cascade)
        await index_1.prisma.favorite.deleteMany({ where: { bouquetId: id } });
        await index_1.prisma.bouquet.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete bouquet' });
    }
});
//# sourceMappingURL=adminBouquets.js.map