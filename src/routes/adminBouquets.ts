import { Router, Response } from 'express';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { upload } from '../middleware/upload';

const router = Router();
router.use(adminAuth);

function parseTags(bouquet: any) {
  try {
    bouquet.tags = typeof bouquet.tags === 'string' ? JSON.parse(bouquet.tags) : bouquet.tags;
  } catch {
    bouquet.tags = [];
  }
  return bouquet;
}

// GET /api/admin/bouquets — все букеты (включая не в наличии)
router.get('/', async (_req: AdminRequest, res: Response) => {
  try {
    const bouquets = await prisma.bouquet.findMany({
      include: { images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(bouquets.map(parseTags));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bouquets' });
  }
});

// POST /api/admin/bouquets — создать букет
router.post('/', upload.array('images', 10), async (req: AdminRequest, res: Response) => {
  try {
    const { name, description, price, oldPrice, category, tags, inStock, isHit, isNew, sortOrder } = req.body;
    const files = req.files as Express.Multer.File[];

    const bouquet = await prisma.bouquet.create({
      data: {
        name,
        description,
        price: parseInt(price),
        oldPrice: oldPrice ? parseInt(oldPrice) : null,
        category: category || 'bouquets',
        tags: tags || '[]',
        inStock: inStock !== 'false',
        isHit: isHit === 'true',
        isNew: isNew === 'true',
        sortOrder: sortOrder ? parseInt(sortOrder) : 0,
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
  } catch (error) {
    console.error('Error creating bouquet:', error);
    res.status(500).json({ error: 'Failed to create bouquet' });
  }
});

// PUT /api/admin/bouquets/:id — обновить букет
router.put('/:id', upload.array('images', 10), async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid bouquet ID' }); return; }
    const { name, description, price, oldPrice, category, tags, inStock, isHit, isNew, sortOrder, deleteImages } = req.body;
    const files = req.files as Express.Multer.File[];

    // Delete specified images
    if (deleteImages) {
      const ids = JSON.parse(deleteImages);
      await prisma.bouquetImage.deleteMany({ where: { id: { in: ids } } });
    }

    const bouquet = await prisma.bouquet.update({
      where: { id },
      data: {
        name,
        description,
        price: parseInt(price),
        oldPrice: oldPrice ? parseInt(oldPrice) : null,
        category: category || 'bouquets',
        tags: tags || '[]',
        inStock: inStock !== 'false',
        isHit: isHit === 'true',
        isNew: isNew === 'true',
        sortOrder: sortOrder ? parseInt(sortOrder) : 0,
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to update bouquet' });
  }
});

// DELETE /api/admin/bouquets/:id — удалить букет
router.delete('/:id', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid bouquet ID' }); return; }

    // Unlink from order items and remove favorites before deleting
    await prisma.orderItem.updateMany({ where: { bouquetId: id }, data: { bouquetId: null } });
    await prisma.favorite.deleteMany({ where: { bouquetId: id } });
    await prisma.bouquet.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bouquet' });
  }
});

export { router as adminBouquetRoutes };
