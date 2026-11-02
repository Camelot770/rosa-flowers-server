import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { upload } from '../middleware/upload';

// Wrapper to handle multer errors gracefully
function handleUpload(fieldName: string, maxCount: number) {
  const multerMiddleware = upload.array(fieldName, maxCount);
  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
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

// PUT /api/admin/bouquets/reorder — новый порядок витрины
router.put('/reorder', async (req: AdminRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id))) {
      res.status(400).json({ error: 'Invalid order' });
      return;
    }
    await prisma.$transaction(ids.map((id: number, index: number) => (
      prisma.bouquet.updateMany({ where: { id }, data: { sortOrder: index } })
    )));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось сохранить порядок' });
  }
});

// POST /api/admin/bouquets/bulk — наличие или цены сразу у нескольких букетов
router.post('/bulk', async (req: AdminRequest, res: Response) => {
  try {
    const { ids, action, percent } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id))) {
      res.status(400).json({ error: 'Выберите букеты' });
      return;
    }

    if (action === 'show' || action === 'hide') {
      const { count } = await prisma.bouquet.updateMany({ where: { id: { in: ids } }, data: { inStock: action === 'show' } });
      res.json({ success: true, count });
      return;
    }

    if (action === 'price') {
      if (typeof percent !== 'number' || !Number.isFinite(percent) || percent === 0 || percent <= -90 || percent > 300) {
        res.status(400).json({ error: 'Укажите изменение цены от -89% до +300%' });
        return;
      }
      const bouquets = await prisma.bouquet.findMany({ where: { id: { in: ids } }, select: { id: true, price: true } });
      // Prices stay round: to the nearest 10 ₽
      await prisma.$transaction(bouquets.map((b) => prisma.bouquet.update({
        where: { id: b.id },
        data: { price: Math.max(10, Math.round((b.price * (100 + percent)) / 1000) * 10) },
      })));
      res.json({ success: true, count: bouquets.length });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось изменить букеты' });
  }
});

// GET /api/admin/bouquets/:id — один букет для редактирования
router.get('/:id', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid bouquet ID' }); return; }
    const bouquet = await prisma.bouquet.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!bouquet) { res.status(404).json({ error: 'Bouquet not found' }); return; }
    res.json(parseTags(bouquet));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bouquet' });
  }
});

// POST /api/admin/bouquets — создать букет
router.post('/', handleUpload('images', 10), async (req: AdminRequest, res: Response) => {
  try {
    const { name, description, price, oldPrice, category, tags, inStock, isHit, isNew, isFeatured, customOrder, sortOrder } = req.body;
    const files = req.files as Express.Multer.File[];

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Укажите название букета' });
      return;
    }
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

    const makeFeatured = isFeatured === 'true';

    const bouquet = await prisma.$transaction(async (tx) => {
      if (makeFeatured) {
        await tx.bouquet.updateMany({ where: { isFeatured: true }, data: { isFeatured: false } });
      }
      return tx.bouquet.create({
        data: {
          name,
          description,
          price: parsedPrice,
          oldPrice: parsedOldPrice,
          category: category || 'bouquets',
          tags: tags
            ? JSON.stringify(tags.split(',').map((t: string) => t.trim()).filter(Boolean))
            : '[]',
          inStock: inStock !== 'false',
          isHit: isHit === 'true',
          isNew: isNew === 'true',
          isFeatured: makeFeatured,
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
    });

    res.json(parseTags(bouquet));
  } catch (error) {
    console.error('Error creating bouquet:', error);
    res.status(500).json({ error: 'Failed to create bouquet' });
  }
});

// PUT /api/admin/bouquets/:id — обновить букет
router.put('/:id', handleUpload('images', 10), async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid bouquet ID' }); return; }
    const { name, description, price, oldPrice, category, tags, inStock, isHit, isNew, isFeatured, customOrder, sortOrder, deleteImages, imageOrder } = req.body;
    const files = req.files as Express.Multer.File[];

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Укажите название букета' });
      return;
    }
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
        await prisma.bouquetImage.deleteMany({ where: { id: { in: ids }, bouquetId: id } });
      } catch {
        res.status(400).json({ error: 'Invalid deleteImages format' });
        return;
      }
    }

    // The photos in the order the admin put them: a number is a saved photo, "new:N" is the Nth uploaded file
    let photoOrder: (number | string)[] = [];
    if (imageOrder) {
      try {
        photoOrder = JSON.parse(imageOrder);
        if (!Array.isArray(photoOrder)) throw new Error('not a list');
      } catch {
        res.status(400).json({ error: 'Invalid imageOrder format' });
        return;
      }
    }
    const newFilePosition = (fileIndex: number) => {
      const position = photoOrder.indexOf(`new:${fileIndex}`);
      return position >= 0 ? position : fileIndex + 100;
    };

    const makeFeatured = isFeatured === 'true';

    const bouquet = await prisma.$transaction(async (tx) => {
      if (makeFeatured) {
        await tx.bouquet.updateMany({ where: { isFeatured: true, NOT: { id } }, data: { isFeatured: false } });
      }
      for (const [position, photo] of photoOrder.entries()) {
        if (typeof photo === 'number') {
          await tx.bouquetImage.updateMany({ where: { id: photo, bouquetId: id }, data: { sortOrder: position } });
        }
      }
      return tx.bouquet.update({
        where: { id },
        data: {
          name,
          description,
          price: parsedPrice,
          oldPrice: parsedOldPrice,
          category: category || 'bouquets',
          tags: tags
            ? JSON.stringify(tags.split(',').map((t: string) => t.trim()).filter(Boolean))
            : '[]',
          inStock: inStock !== 'false',
          isHit: isHit === 'true',
          isNew: isNew === 'true',
          // A form that did not change the flag leaves it out, so a stale form cannot overwrite it
          isFeatured: isFeatured === undefined ? undefined : makeFeatured,
          customOrder: customOrder === 'true',
          sortOrder: Math.max(0, parseInt(sortOrder) || 0),
          images: files?.length ? {
            create: files.map((f, i) => ({
              url: `/uploads/${f.filename}`,
              sortOrder: newFilePosition(i),
            })),
          } : undefined,
        },
        include: { images: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    res.json(parseTags(bouquet));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update bouquet' });
  }
});

// PATCH /api/admin/bouquets/:id/price — цена прямо из списка
router.patch('/:id/price', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid bouquet ID' }); return; }
    const { price } = req.body;
    if (!Number.isInteger(price) || price < 1) {
      res.status(400).json({ error: 'Цена должна быть положительным числом' });
      return;
    }
    const bouquet = await prisma.bouquet.update({ where: { id }, data: { price } });
    res.json({ success: true, price: bouquet.price });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось изменить цену' });
  }
});

// POST /api/admin/bouquets/:id/duplicate — копия, скрытая с витрины, пока её не поправят
router.post('/:id/duplicate', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid bouquet ID' }); return; }
    const source = await prisma.bouquet.findUnique({ where: { id }, include: { images: { orderBy: { sortOrder: 'asc' } } } });
    if (!source) { res.status(404).json({ error: 'Букет не найден' }); return; }

    const copy = await prisma.bouquet.create({
      data: {
        name: `${source.name} (копия)`,
        description: source.description,
        price: source.price,
        oldPrice: source.oldPrice,
        category: source.category,
        tags: source.tags,
        inStock: false,
        isHit: false,
        isNew: false,
        isFeatured: false,
        customOrder: false,
        sortOrder: source.sortOrder + 1,
        images: { create: source.images.map((image) => ({ url: image.url, sortOrder: image.sortOrder })) },
      },
    });
    res.json({ id: copy.id });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось скопировать букет' });
  }
});

// PATCH /api/admin/bouquets/:id/toggle — quick toggle field
router.patch('/:id/toggle', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid bouquet ID' }); return; }
    const { field, value } = req.body;
    if (!['inStock', 'isHit', 'isNew', 'isFeatured', 'customOrder'].includes(field) || typeof value !== 'boolean') {
      res.status(400).json({ error: 'Invalid field or value' });
      return;
    }
    const bouquet = await prisma.$transaction(async (tx) => {
      if (field === 'isFeatured' && value === true) {
        await tx.bouquet.updateMany({ where: { isFeatured: true, NOT: { id } }, data: { isFeatured: false } });
      }
      return tx.bouquet.update({ where: { id }, data: { [field]: value } });
    });
    res.json({ success: true, [field]: (bouquet as any)[field] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle field' });
  }
});

// DELETE /api/admin/bouquets/:id — удалить букет
router.delete('/:id', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid bouquet ID' }); return; }

    // Remove favorites before deleting (orderItems are unlinked via onDelete: SetNull, images cascade)
    await prisma.favorite.deleteMany({ where: { bouquetId: id } });
    await prisma.bouquet.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bouquet' });
  }
});

export { router as adminBouquetRoutes };
