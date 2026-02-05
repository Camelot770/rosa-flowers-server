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
    { key: 'delivery_price', value: '300' },
    { key: 'free_delivery_from', value: '3000' },
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

  // Bouquets — 10 стабилизированных композиций (реальные данные из таблицы)
  const bouquets = [
    {
      name: 'Мини-композиция с хлопком',
      description: 'Компактная стабилизированная композиция с хлопком и сухоцветами в декоративном горшочке. Высота 10 см, диаметр 13 см.',
      price: 1590,
      category: 'stabilized',
      tags: ['стабилизированные', 'хлопок', 'мини'],
      isNew: true,
      images: ['/public/bouquets/bouquet-01.jpeg'],
    },
    {
      name: 'Нежная композиция в кашпо',
      description: 'Стабилизированная композиция из роз и гортензии в аккуратном кашпо. Высота 13 см, диаметр 15 см.',
      price: 1380,
      category: 'stabilized',
      tags: ['стабилизированные', 'розы', 'гортензия'],
      images: ['/public/bouquets/bouquet-02.jpeg'],
    },
    {
      name: 'Розовая гармония',
      description: 'Стабилизированные розы с эвкалиптом и декоративной зеленью в круглой коробке. Высота 17 см, диаметр 15 см.',
      price: 1670,
      category: 'stabilized',
      tags: ['стабилизированные', 'розы', 'эвкалипт'],
      isHit: true,
      images: ['/public/bouquets/bouquet-03.jpeg'],
    },
    {
      name: 'Пышная коробочка',
      description: 'Объёмная композиция из стабилизированных роз, гортензии и хлопка в шляпной коробке. Высота 15 см, диаметр 17 см.',
      price: 1980,
      category: 'stabilized',
      tags: ['стабилизированные', 'коробка', 'розы', 'гортензия'],
      isHit: true,
      images: ['/public/bouquets/bouquet-04.jpeg'],
    },
    {
      name: 'Премиум-композиция «Роскошь»',
      description: 'Премиальная стабилизированная композиция с розами, хлопком, лавандой и эвкалиптом в дизайнерской коробке. Высота 25 см, диаметр 22 см.',
      price: 3990,
      category: 'stabilized',
      tags: ['стабилизированные', 'премиум', 'лаванда', 'хлопок'],
      isHit: true,
      images: ['/public/bouquets/bouquet-05.jpeg'],
    },
    {
      name: 'Классическая шляпная коробка',
      description: 'Стабилизированные розы и зелень в элегантной шляпной коробке. Высота 20 см, диаметр 20 см.',
      price: 2490,
      category: 'stabilized',
      tags: ['стабилизированные', 'шляпная коробка', 'розы'],
      isNew: true,
      images: ['/public/bouquets/bouquet-06.jpeg'],
    },
    {
      name: 'Интерьерная композиция «Уют»',
      description: 'Стабилизированная интерьерная композиция с розами, хлопком и сухоцветами. Высота 22 см, диаметр 20 см.',
      price: 2990,
      category: 'stabilized',
      tags: ['стабилизированные', 'интерьер', 'хлопок'],
      images: ['/public/bouquets/bouquet-07.jpeg'],
    },
    {
      name: 'Композиция «Нежность»',
      description: 'Нежная стабилизированная композиция в пастельных тонах с розами и гортензией. Высота 20 см, диаметр 17 см.',
      price: 2690,
      category: 'stabilized',
      tags: ['стабилизированные', 'нежный', 'пастельный'],
      images: ['/public/bouquets/bouquet-08.jpeg'],
    },
    {
      name: 'Гранд-композиция «Королевская»',
      description: 'Большая премиальная композиция из стабилизированных роз, пионов и декоративной зелени в подарочной коробке. Высота 30 см, диаметр 30 см.',
      price: 7900,
      category: 'stabilized',
      tags: ['стабилизированные', 'премиум', 'большая', 'подарок'],
      isHit: true,
      images: ['/public/bouquets/bouquet-09.jpeg'],
    },
    {
      name: 'Люкс-композиция «Вдохновение»',
      description: 'Роскошная стабилизированная композиция с розами, гортензией и декоративными элементами в дизайнерском кашпо. Высота 25 см, диаметр 25 см.',
      price: 5900,
      category: 'stabilized',
      tags: ['стабилизированные', 'люкс', 'дизайнерская'],
      images: ['/public/bouquets/bouquet-10.jpeg'],
    },
  ];

  for (let i = 0; i < bouquets.length; i++) {
    const b = bouquets[i];
    const bouquet = await prisma.bouquet.upsert({
      where: { id: i + 1 },
      update: {},
      create: {
        name: b.name,
        description: b.description,
        price: b.price,
        oldPrice: b.oldPrice,
        category: b.category,
        tags: b.tags,
        isHit: b.isHit || false,
        isNew: b.isNew || false,
        sortOrder: i,
      },
    });

    for (let j = 0; j < b.images.length; j++) {
      await prisma.bouquetImage.upsert({
        where: { id: i * 10 + j + 1 },
        update: {},
        create: {
          id: i * 10 + j + 1,
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

  for (let i = 0; i < flowers.length; i++) {
    await prisma.flower.upsert({
      where: { id: i + 1 },
      update: {},
      create: { id: i + 1, ...flowers[i] },
    });
  }

  // Constructor — Greenery
  const greenery = [
    { name: 'Эвкалипт', price: 80, imageUrl: '/assets/constructor/eucalyptus.jpg' },
    { name: 'Рускус', price: 60, imageUrl: '/assets/constructor/ruscus.jpg' },
    { name: 'Писташ', price: 70, imageUrl: '/assets/constructor/pistache.jpg' },
    { name: 'Салал', price: 50, imageUrl: '/assets/constructor/salal.jpg' },
  ];

  for (let i = 0; i < greenery.length; i++) {
    await prisma.greenery.upsert({
      where: { id: i + 1 },
      update: {},
      create: { id: i + 1, ...greenery[i] },
    });
  }

  // Constructor — Packaging
  const packaging = [
    { name: 'Крафт', price: 150, imageUrl: '/assets/constructor/kraft.jpg' },
    { name: 'Плёнка матовая', price: 200, imageUrl: '/assets/constructor/matte.jpg' },
    { name: 'Шляпная коробка', price: 500, imageUrl: '/assets/constructor/hatbox.jpg' },
    { name: 'Корзина', price: 400, imageUrl: '/assets/constructor/basket.jpg' },
  ];

  for (let i = 0; i < packaging.length; i++) {
    await prisma.packaging.upsert({
      where: { id: i + 1 },
      update: {},
      create: { id: i + 1, ...packaging[i] },
    });
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
