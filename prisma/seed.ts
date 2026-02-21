import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌹 Seeding Rosa Flowers database...');

  // Admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.adminUser.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      password: hashedPassword,
      name: 'Администратор',
    },
  });

  // Settings
  const settings = [
    { key: 'studio_name', value: 'Роза цветов' },
    { key: 'phone', value: '+79178765958' },
    { key: 'email', value: 'rozacvetov@list.ru' },
    { key: 'address', value: 'д. Званка, ул. Приозёрная, д. 58' },
    { key: 'work_hours', value: '9:00 – 21:00' },
    { key: 'delivery_price', value: '500' },
    { key: 'free_delivery_from', value: '5000' },
    { key: 'min_order', value: '1000' },
    { key: 'bonus_percent', value: '5' },
    { key: 'max_bonus_discount', value: '20' },
    { key: 'telegram_channel', value: '@rozacvetov' },
    { key: 'instagram', value: 'rozacvetov' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  // Bouquets — 37 стабилизированных композиций (полный каталог из таблицы)
  const IMG = 'https://rosa-flowers-client.vercel.app/bouquets';
  const bouquets = [
    {
      name: 'Соната',
      description: 'Стабилизированная композиция. Высота 15 см, диаметр 15 см.',
      price: 1600,
      category: 'stabilized',
      tags: ['стабилизированные', 'мини'],
      isNew: true,
      images: [`${IMG}/bouquet-01.jpeg`],
    },
    {
      name: 'Ноктюрн',
      description: 'Стабилизированная композиция. Высота 15 см, диаметр 15 см.',
      price: 1400,
      category: 'stabilized',
      tags: ['стабилизированные', 'мини'],
      images: [`${IMG}/bouquet-02.jpeg`],
    },
    {
      name: 'Нимфа',
      description: 'Стабилизированная композиция. Высота 10 см, диаметр 13 см.',
      price: 1700,
      category: 'stabilized',
      tags: ['стабилизированные', 'мини'],
      images: [`${IMG}/bouquet-03.jpeg`],
    },
    {
      name: 'Элегия',
      description: 'Стабилизированная композиция. Высота 20 см, диаметр 20 см.',
      price: 2000,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-04.jpeg`],
    },
    {
      name: 'Ритм',
      description: 'Стабилизированная композиция. Высота 25 см, диаметр 25 см.',
      price: 4000,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      isHit: true,
      images: [`${IMG}/bouquet-05.jpeg`],
    },
    {
      name: 'Шопен',
      description: 'Стабилизированная композиция. Высота 20 см, диаметр 24 см.',
      price: 2500,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-06.jpeg`],
    },
    {
      name: 'Адажио',
      description: 'Стабилизированная композиция. Высота 20 см, диаметр 24 см.',
      price: 3000,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-07.jpeg`],
    },
    {
      name: 'Мазурка',
      description: 'Стабилизированная композиция. Высота 17 см, диаметр 22 см.',
      price: 2700,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-08.jpeg`],
    },
    {
      name: 'Рапсодия',
      description: 'Стабилизированная композиция. Высота 30 см, диаметр 30 см.',
      price: 7900,
      category: 'stabilized',
      tags: ['стабилизированные', 'премиум', 'большой'],
      isHit: true,
      images: [`${IMG}/bouquet-09.jpeg`],
    },
    {
      name: 'Аллегро',
      description: 'Стабилизированная композиция. Высота 35 см, диаметр 35 см.',
      price: 5900,
      category: 'stabilized',
      tags: ['стабилизированные', 'большой'],
      images: [`${IMG}/bouquet-10.jpeg`],
    },
    {
      name: 'Граве',
      description: 'Стабилизированная композиция. Высота 35 см, диаметр 35 см.',
      price: 5900,
      category: 'stabilized',
      tags: ['стабилизированные', 'большой'],
      images: [`${IMG}/bouquet-11.jpeg`],
    },
    {
      name: 'Романс',
      description: 'Стабилизированная композиция. Высота 35 см, диаметр 35 см.',
      price: 5900,
      category: 'stabilized',
      tags: ['стабилизированные', 'большой'],
      isNew: true,
      images: [`${IMG}/bouquet-12.jpeg`],
    },
    {
      name: 'Литавра',
      description: 'Стабилизированная композиция. Высота 35 см, диаметр 40 см.',
      price: 6300,
      category: 'stabilized',
      tags: ['стабилизированные', 'большой'],
      images: [`${IMG}/bouquet-13.jpeg`],
    },
    {
      name: 'Клавир',
      description: 'Стабилизированная композиция. Высота 35 см, диаметр 40 см.',
      price: 6300,
      category: 'stabilized',
      tags: ['стабилизированные', 'большой'],
      images: [`${IMG}/bouquet-14.jpeg`],
    },
    {
      name: 'Штраус',
      description: 'Стабилизированная композиция. Высота 18 см, диаметр 18 см.',
      price: 3500,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-15.jpeg`],
    },
    {
      name: 'Аккорд',
      description: 'Стабилизированная композиция. Высота 20 см, диаметр 20 см.',
      price: 3300,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-16.jpeg`],
    },
    {
      name: 'Сюита',
      description: 'Стабилизированная композиция. Высота 17 см, диаметр 17 см.',
      price: 2700,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-17.jpeg`],
    },
    {
      name: 'Скрипка',
      description: 'Стабилизированная композиция. Высота 17 см, диаметр 17 см.',
      price: 2700,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-18.jpeg`],
    },
    {
      name: 'Ларго',
      description: 'Стабилизированная композиция. Высота 35 см, диаметр 35 см.',
      price: 6900,
      category: 'stabilized',
      tags: ['стабилизированные', 'премиум', 'большой'],
      isHit: true,
      images: [`${IMG}/bouquet-19.jpeg`],
    },
    {
      name: 'Гармония',
      description: 'Стабилизированная композиция. Высота 35 см, диаметр 35 см.',
      price: 6800,
      category: 'stabilized',
      tags: ['стабилизированные', 'большой'],
      images: [`${IMG}/bouquet-20.jpeg`],
    },
    {
      name: 'Бетховен',
      description: 'Стабилизированная композиция. Высота 20 см, диаметр 20 см.',
      price: 3700,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-21.jpeg`],
    },
    {
      name: 'Моцарт',
      description: 'Стабилизированная композиция. Высота 20 см, диаметр 20 см.',
      price: 3700,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-22.jpeg`],
    },
    {
      name: 'Созвучие',
      description: 'Стабилизированная композиция. Высота 20 см, диаметр 20 см.',
      price: 4500,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      isHit: true,
      images: [`${IMG}/bouquet-23.jpeg`],
    },
    {
      name: 'Мелодия',
      description: 'Стабилизированная композиция. Высота 23 см, диаметр 23 см.',
      price: 4400,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-24.jpeg`],
    },
    {
      name: 'Дебюсси',
      description: 'Стабилизированная композиция. Высота 35 см, диаметр 35 см.',
      price: 5600,
      category: 'stabilized',
      tags: ['стабилизированные', 'большой'],
      images: [`${IMG}/bouquet-25.jpeg`],
    },
    {
      name: 'Партитура',
      description: 'Стабилизированная композиция. Высота 25 см, диаметр 27 см.',
      price: 3600,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-26.jpeg`],
    },
    {
      name: 'Пастораль',
      description: 'Стабилизированная композиция. Высота 17 см, диаметр 17 см.',
      price: 2700,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      isNew: true,
      images: [`${IMG}/bouquet-27.jpeg`],
    },
    {
      name: 'Легато',
      description: 'Стабилизированная композиция. Высота 23 см, диаметр 23 см.',
      price: 3500,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-28.jpeg`],
    },
    {
      name: 'Триоль',
      description: 'Стабилизированная композиция. Высота 35 см, диаметр 35 см.',
      price: 5600,
      category: 'stabilized',
      tags: ['стабилизированные', 'большой'],
      images: [`${IMG}/bouquet-29.jpeg`],
    },
    {
      name: 'Серенада',
      description: 'Стабилизированная композиция. Высота 30 см, диаметр 30 см.',
      price: 9500,
      category: 'stabilized',
      tags: ['стабилизированные', 'премиум', 'большой'],
      isHit: true,
      images: [`${IMG}/bouquet-30.jpeg`],
    },
    {
      name: 'Ля-минор',
      description: 'Стабилизированная композиция. Высота 18 см, диаметр 15 см.',
      price: 2200,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-31.jpeg`],
    },
    {
      name: 'Ля-мажор',
      description: 'Стабилизированная композиция. Высота 18 см, диаметр 15 см.',
      price: 2200,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-32.jpeg`],
    },
    {
      name: 'Фантазия',
      description: 'Стабилизированная композиция. Высота 35 см, диаметр 35 см.',
      price: 6300,
      category: 'stabilized',
      tags: ['стабилизированные', 'большой'],
      images: [`${IMG}/bouquet-33.jpeg`],
    },
    {
      name: 'Каденция',
      description: 'Стабилизированная композиция. Высота 25 см, диаметр 20 см.',
      price: 3900,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      isNew: true,
      images: [`${IMG}/bouquet-34.jpeg`],
    },
    {
      name: 'Арфа',
      description: 'Стабилизированная композиция. Высота 25 см, диаметр 27 см.',
      price: 5000,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-35.jpeg`],
    },
    {
      name: 'Флейта',
      description: 'Стабилизированная композиция. Высота 21 см, диаметр 21 см.',
      price: 3100,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      images: [`${IMG}/bouquet-36.jpeg`],
    },
    {
      name: 'Полифония',
      description: 'Стабилизированная композиция. Высота 23 см, диаметр 26 см.',
      price: 5000,
      category: 'stabilized',
      tags: ['стабилизированные', 'средний'],
      isHit: true,
      images: [`${IMG}/bouquet-37.jpeg`],
    },
    {
      name: 'Тест',
      description: 'Тестовый букет для проверки оплаты.',
      price: 30,
      category: 'stabilized',
      tags: ['тест'],
      images: [`${IMG}/bouquet-01.jpeg`],
    },
  ];

  // Удаляем все старые букеты и их изображения перед вставкой новых
  const bouquetNames = bouquets.map((b) => b.name);
  // Удалить изображения букетов, которых нет в новом каталоге
  const oldBouquets = await prisma.bouquet.findMany({
    where: { name: { notIn: bouquetNames } },
    select: { id: true },
  });
  if (oldBouquets.length > 0) {
    const oldIds = oldBouquets.map((b) => b.id);
    await prisma.bouquetImage.deleteMany({ where: { bouquetId: { in: oldIds } } });
    await prisma.bouquet.deleteMany({ where: { id: { in: oldIds } } });
    console.log(`🗑️  Removed ${oldBouquets.length} old bouquets not in catalog`);
  }

  for (let i = 0; i < bouquets.length; i++) {
    const b = bouquets[i];
    const existing = await prisma.bouquet.findFirst({ where: { name: b.name } });
    if (existing) {
      // Обновляем существующий букет (цена, описание и т.д.)
      await prisma.bouquet.update({
        where: { id: existing.id },
        data: {
          description: b.description,
          price: b.price,
          oldPrice: (b as any).oldPrice || null,
          category: b.category,
          tags: JSON.stringify(b.tags),
          isHit: b.isHit || false,
          isNew: b.isNew || false,
          sortOrder: i,
        },
      });
      // Обновляем изображения
      await prisma.bouquetImage.deleteMany({ where: { bouquetId: existing.id } });
      for (let j = 0; j < b.images.length; j++) {
        await prisma.bouquetImage.create({
          data: {
            bouquetId: existing.id,
            url: b.images[j],
            sortOrder: j,
          },
        });
      }
      continue;
    }

    const bouquet = await prisma.bouquet.create({
      data: {
        name: b.name,
        description: b.description,
        price: b.price,
        oldPrice: (b as any).oldPrice,
        category: b.category,
        tags: JSON.stringify(b.tags),
        isHit: b.isHit || false,
        isNew: b.isNew || false,
        sortOrder: i,
      },
    });

    for (let j = 0; j < b.images.length; j++) {
      await prisma.bouquetImage.create({
        data: {
          bouquetId: bouquet.id,
          url: b.images[j],
          sortOrder: j,
        },
      });
    }
  }

  // Constructor — Flowers
  const flowers = [
    { name: 'Роза', price: 150, imageUrl: '/assets/constructor/rose.jpg' },
    { name: 'Тюльпан', price: 120, imageUrl: '/assets/constructor/tulip.jpg' },
    { name: 'Хризантема', price: 100, imageUrl: '/assets/constructor/chrysanthemum.jpg' },
    { name: 'Гербера', price: 130, imageUrl: '/assets/constructor/gerbera.jpg' },
    { name: 'Пион', price: 350, imageUrl: '/assets/constructor/peony.jpg' },
  ];

  for (const f of flowers) {
    const existing = await prisma.flower.findFirst({ where: { name: f.name } });
    if (!existing) {
      await prisma.flower.create({ data: f });
    }
  }

  // Constructor — Greenery
  const greenery = [
    { name: 'Эвкалипт', price: 80, imageUrl: '/assets/constructor/eucalyptus.jpg' },
    { name: 'Рускус', price: 60, imageUrl: '/assets/constructor/ruscus.jpg' },
    { name: 'Писташ', price: 70, imageUrl: '/assets/constructor/pistache.jpg' },
    { name: 'Салал', price: 50, imageUrl: '/assets/constructor/salal.jpg' },
  ];

  for (const g of greenery) {
    const existing = await prisma.greenery.findFirst({ where: { name: g.name } });
    if (!existing) {
      await prisma.greenery.create({ data: g });
    }
  }

  // Constructor — Packaging
  const packaging = [
    { name: 'Крафт', price: 150, imageUrl: '/assets/constructor/kraft.jpg' },
    { name: 'Плёнка матовая', price: 200, imageUrl: '/assets/constructor/matte.jpg' },
    { name: 'Шляпная коробка', price: 500, imageUrl: '/assets/constructor/hatbox.jpg' },
    { name: 'Корзина', price: 400, imageUrl: '/assets/constructor/basket.jpg' },
  ];

  for (const p of packaging) {
    const existing = await prisma.packaging.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.packaging.create({ data: p });
    }
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
