import { Router, Response } from 'express';
import { prisma } from '../index';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { upload } from '../middleware/upload';

const router = Router();
router.use(adminAuth);

// GET /api/admin/constructor — все элементы конструктора
router.get('/', async (_req: AdminRequest, res: Response) => {
  try {
    const [flowers, greenery, packaging] = await Promise.all([
      prisma.flower.findMany(),
      prisma.greenery.findMany(),
      prisma.packaging.findMany(),
    ]);
    res.json({ flowers, greenery, packaging });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch constructor items' });
  }
});

// POST /api/admin/constructor/flowers
router.post('/flowers', upload.single('image'), async (req: AdminRequest, res: Response) => {
  try {
    const { name, price, inStock } = req.body;
    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      res.status(400).json({ error: 'Invalid price' });
      return;
    }
    const file = req.file;
    const flower = await prisma.flower.create({
      data: {
        name,
        price: priceNum,
        imageUrl: file ? `/uploads/${file.filename}` : null,
        inStock: inStock !== 'false',
      },
    });
    res.json(flower);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create flower' });
  }
});

// PUT /api/admin/constructor/flowers/:id
router.put('/flowers/:id', upload.single('image'), async (req: AdminRequest, res: Response) => {
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
    const flower = await prisma.flower.update({
      where: { id },
      data: {
        name,
        price: priceNum,
        ...(file ? { imageUrl: `/uploads/${file.filename}` } : {}),
        inStock: inStock !== 'false',
      },
    });
    res.json(flower);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update flower' });
  }
});

// DELETE /api/admin/constructor/flowers/:id
router.delete('/flowers/:id', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }
    await prisma.flower.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete flower' });
  }
});

// POST /api/admin/constructor/greenery
router.post('/greenery', upload.single('image'), async (req: AdminRequest, res: Response) => {
  try {
    const { name, price, inStock } = req.body;
    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      res.status(400).json({ error: 'Invalid price' });
      return;
    }
    const file = req.file;
    const item = await prisma.greenery.create({
      data: {
        name,
        price: priceNum,
        imageUrl: file ? `/uploads/${file.filename}` : null,
        inStock: inStock !== 'false',
      },
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create greenery' });
  }
});

// PUT /api/admin/constructor/greenery/:id
router.put('/greenery/:id', upload.single('image'), async (req: AdminRequest, res: Response) => {
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
    const item = await prisma.greenery.update({
      where: { id },
      data: {
        name,
        price: priceNum,
        ...(file ? { imageUrl: `/uploads/${file.filename}` } : {}),
        inStock: inStock !== 'false',
      },
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update greenery' });
  }
});

// DELETE /api/admin/constructor/greenery/:id
router.delete('/greenery/:id', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }
    await prisma.greenery.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete greenery' });
  }
});

// POST /api/admin/constructor/packaging
router.post('/packaging', upload.single('image'), async (req: AdminRequest, res: Response) => {
  try {
    const { name, price, inStock } = req.body;
    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      res.status(400).json({ error: 'Invalid price' });
      return;
    }
    const file = req.file;
    const item = await prisma.packaging.create({
      data: {
        name,
        price: priceNum,
        imageUrl: file ? `/uploads/${file.filename}` : null,
        inStock: inStock !== 'false',
      },
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create packaging' });
  }
});

// PUT /api/admin/constructor/packaging/:id
router.put('/packaging/:id', upload.single('image'), async (req: AdminRequest, res: Response) => {
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
    const item = await prisma.packaging.update({
      where: { id },
      data: {
        name,
        price: priceNum,
        ...(file ? { imageUrl: `/uploads/${file.filename}` } : {}),
        inStock: inStock !== 'false',
      },
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update packaging' });
  }
});

// DELETE /api/admin/constructor/packaging/:id
router.delete('/packaging/:id', async (req: AdminRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }
    await prisma.packaging.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete packaging' });
  }
});

export { router as adminConstructorRoutes };
