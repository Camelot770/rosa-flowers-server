/**
 * One-time idempotent bouquet rename to match the air-themed collections
 * used on rosa-web (Штиль / Бриз / Полёт / Высота).
 *
 * Runs at server startup. Uses a Setting row as a "migration applied"
 * flag, so it only does work on the first boot after deploy — subsequent
 * restarts are no-ops. If you ever want to re-rename, delete the Setting
 * row with key `bouquet_rename_air_v1` and restart.
 *
 * Existing OrderItem rows are NOT touched — their `name` field is a
 * snapshot taken at order-creation time, so historical orders keep their
 * original names (which is what bookkeeping wants).
 */

import { prisma } from '../index';

const FLAG_KEY = 'bouquet_rename_air_v1';

const RENAMES: Record<number, string> = {
  // ── Штиль (1 400 – 2 550 ₽) ──────────────────────────────
  120: 'Тишина',
  11: 'Шёпот',
  137: 'Дымка',
  14: 'Иней',
  71: 'Пауза',
  125: 'Полусон',
  117: 'Безмолвие',
  136: 'Утро',

  // ── Бриз (2 850 – 4 380 ₽) ───────────────────────────────
  143: 'Бриз',
  121: 'Свежесть',
  60: 'Рассвет',
  129: 'Прибой',
  128: 'Парус',
  135: 'Залив',
  138: 'Побережье',
  139: 'Муссон',
  147: 'Узор',
  114: 'Маре',
  116: 'Тёплый ветер',

  // ── Полёт (4 500 – 6 500 ₽) ──────────────────────────────
  140: 'Парение',
  115: 'Перо',
  113: 'Крыло',
  112: 'Ласточка',
  141: 'Полёт',
  127: 'Вираж',
  57: 'Взмах',
  133: 'Лебедь',
  134: 'Ястреб',

  // ── Высота (7 000 – 12 000 ₽) ────────────────────────────
  110: 'Облако',
  130: 'Стратосфера',
  19: 'Высь',
  124: 'Орбита',
  119: 'Альпы',
  118: 'Космос',
  111: 'Эфир',
  148: 'Звезда',
  144: 'Эльбрус',
  145: 'Монблан',
  146: 'Эверест',
  142: 'Вершина',
};

export async function applyBouquetRenames(): Promise<void> {
  try {
    const flag = await prisma.setting.findUnique({ where: { key: FLAG_KEY } });
    if (flag) {
      console.log(`[startup] bouquet rename (${FLAG_KEY}) already applied, skipping`);
      return;
    }

    console.log('[startup] applying one-time bouquet renames → air collections…');
    let renamed = 0;
    let unchanged = 0;
    let missing = 0;

    for (const [idStr, newName] of Object.entries(RENAMES)) {
      const id = Number(idStr);
      const existing = await prisma.bouquet.findUnique({
        where: { id },
        select: { id: true, name: true },
      });
      if (!existing) {
        console.warn(`  · bouquet id=${id} not found in DB, skipped`);
        missing++;
        continue;
      }
      if (existing.name === newName) {
        unchanged++;
        continue;
      }
      await prisma.bouquet.update({ where: { id }, data: { name: newName } });
      console.log(`  ✓ ${existing.name} → ${newName} (id=${id})`);
      renamed++;
    }

    await prisma.setting.upsert({
      where: { key: FLAG_KEY },
      update: { value: '1' },
      create: { key: FLAG_KEY, value: '1' },
    });

    console.log(
      `[startup] bouquet rename done. renamed=${renamed}, unchanged=${unchanged}, missing=${missing}. flag ${FLAG_KEY} set.`,
    );
  } catch (e) {
    // Never crash server boot because of a rename hiccup — log and move on.
    console.error('[startup] applyBouquetRenames failed:', e);
  }
}
