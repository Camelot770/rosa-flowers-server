/**
 * Delta migration on top of v2 (`bouquet_rename_music_v1`).
 *
 * Reason: v2 already ran on prod (its flag is set), so editing its
 * RENAMES map in place is a no-op — the function returns early without
 * touching the DB. To soften 13 names that read too academic/funereal
 * (Арпеджио, Багатель, Колыбельная, Контрапункт, Менуэт, Фуга, Тутти,
 * Партита, Реквием, Финал, Гимн, Эпилог, Апофеоз), we run a separate
 * idempotent pass under flag `bouquet_rename_music_v2`.
 *
 * After this runs once, the DB matches the frontend snapshot in
 * lib/bouquets-data.ts exactly. Existing OrderItem rows are NOT touched.
 */

import { prisma } from '../index';

const FLAG_KEY = 'bouquet_rename_music_v2';

const RENAMES: Record<number, string> = {
  // Соло
  11:  'Элегия',         // was Арпеджио
  14:  'Идиллия',        // was Багатель
  71:  'Канцона',        // was Колыбельная

  // Дуэт
  143: 'Вальс',          // was Контрапункт
  138: 'Полонез',        // was Менуэт

  // Квартет
  115: 'Дивертисмент',   // was Фуга
  141: 'Интермеццо',     // was Тутти
  57:  'Симфониетта',    // was Партита

  // Оркестр
  118: 'Поэма',          // was Реквием
  148: 'Хорал',          // was Финал
  144: 'Песнь',          // was Гимн
  146: 'Кода',           // was Эпилог
  142: 'Бравура',        // was Апофеоз
};

export async function applyBouquetRenamesV3(): Promise<void> {
  try {
    const flag = await prisma.setting.findUnique({ where: { key: FLAG_KEY } });
    if (flag) {
      console.log(`[startup] bouquet rename v3 (${FLAG_KEY}) already applied, skipping`);
      return;
    }

    console.log('[startup] applying delta bouquet rename v3 → softer music names…');
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
      `[startup] bouquet rename v3 done. renamed=${renamed}, unchanged=${unchanged}, missing=${missing}. flag ${FLAG_KEY} set.`,
    );
  } catch (e) {
    console.error('[startup] applyBouquetRenamesV3 failed:', e);
  }
}
