import bcrypt from 'bcryptjs';
import { prisma } from '../index';
import { DEFAULT_ADMIN_PASSWORD } from '../middleware/adminAuth';
import { applyBouquetRenames } from './applyBouquetRenames';
import { applyBouquetRenamesV2 } from './applyBouquetRenamesV2';
import { applyBouquetRenamesV3 } from './applyBouquetRenamesV3';

// The rename tasks target the ids of the old catalog (11-148). A re-seeded catalog has ids 1-38,
// where the same ids are unrelated bouquets. Ids this high exist only in a restored old database.
const OLD_CATALOG_MIN_ID = 100;
const RENAME_FLAGS = ['bouquet_rename_air_v1', 'bouquet_rename_music_v1', 'bouquet_rename_music_v2'];
const REPAIR_FLAG = 'reseeded_catalog_repair_v1';

// What the rename tasks did to a re-seeded catalog. They raced, so either name could have won.
const WRONG_RENAMES = [
  { id: 11, seedName: 'Граве', renamedTo: ['Шёпот', 'Элегия'] },
  { id: 14, seedName: 'Клавир', renamedTo: ['Иней', 'Идиллия'] },
  { id: 19, seedName: 'Ларго', renamedTo: ['Высь', 'Увертюра'] },
];

async function repairReseededCatalog() {
  const applied = await prisma.setting.findUnique({ where: { key: REPAIR_FLAG } });
  if (applied) return;

  for (const key of RENAME_FLAGS) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value: '1' } });
  }

  for (const { id, seedName, renamedTo } of WRONG_RENAMES) {
    const restored = await prisma.bouquet.updateMany({
      where: { id, name: { in: renamedTo } },
      data: { name: seedName },
    });
    if (restored.count > 0) console.log(`[startup] restored name of bouquet ${id}: ${seedName}`);
  }

  // The payment test item stays in the admin panel, but customers should not see it
  const hidden = await prisma.bouquet.updateMany({
    where: { name: 'Тест', price: 30, inStock: true },
    data: { inStock: false },
  });
  if (hidden.count > 0) console.log('[startup] test bouquet hidden from the catalog');

  await prisma.setting.create({ data: { key: REPAIR_FLAG, value: '1' } });
}

async function replaceDefaultAdminPassword() {
  const admins = await prisma.adminUser.findMany();
  for (const admin of admins) {
    if (!(await bcrypt.compare(DEFAULT_ADMIN_PASSWORD, admin.password))) continue;

    const newPassword = process.env.ADMIN_PASSWORD;
    if (newPassword && newPassword !== DEFAULT_ADMIN_PASSWORD) {
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { password: await bcrypt.hash(newPassword, 10), tokenVersion: { increment: 1 } },
      });
      console.log(`[startup] default password of admin ${admin.login} replaced from ADMIN_PASSWORD`);
    } else {
      console.warn(`[startup] SECURITY: admin ${admin.login} still uses the default password. Set ADMIN_PASSWORD or change it in the admin panel.`);
    }
  }
}

export async function runStartupTasks() {
  await replaceDefaultAdminPassword();

  const { _max } = await prisma.bouquet.aggregate({ _max: { id: true } });
  if ((_max.id || 0) >= OLD_CATALOG_MIN_ID) {
    await applyBouquetRenames();
    await applyBouquetRenamesV2();
    await applyBouquetRenamesV3();
  } else {
    await repairReseededCatalog();
  }
}
