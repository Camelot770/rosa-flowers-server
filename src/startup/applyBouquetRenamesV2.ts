/**
 * One-time idempotent rebrand of all 40 bouquets to match the new
 * "musical ensemble" collections used on rosa-web:
 *
 *   Соло    · Прелюдия / Арпеджио / Этюд / Багатель / ...
 *   Дуэт    · Контрапункт / Канон / Эхо / Гармония / ...
 *   Квартет · Соната / Фуга / Аккорд / Каденция / ...
 *   Оркестр · Симфония / Концерт / Увертюра / Кантата / ...
 *
 * Runs at server startup. Uses a Setting row as a "migration applied"
 * flag, so it only does work on the first boot after deploy — subsequent
 * restarts are no-ops. If you ever want to re-rename, delete the Setting
 * row with key `bouquet_rename_music_v1` and restart.
 *
 * The earlier v1 task (`applyBouquetRenames` → air-themed names like
 * Тишина/Шёпот/Облако) has already run and set its own flag, so it stays
 * a no-op forever — this v2 simply overwrites those names. Existing
 * OrderItem rows are NOT touched: their `name` field is a snapshot taken
 * at order-creation time, so historical orders keep whichever name they
 * were placed under.
 */

import { prisma } from '../index';

const FLAG_KEY = 'bouquet_rename_music_v1';

const RENAMES: Record<number, string> = {
  // ── Соло (1 400 – 2 550 ₽) — один голос, лёгкие букеты у окна ────────────
  120: 'Прелюдия',
  11:  'Элегия',
  137: 'Этюд',
  14:  'Идиллия',
  71:  'Канцона',
  125: 'Адажио',
  117: 'Ноктюрн',
  136: 'Романс',

  // ── Дуэт (2 850 – 4 380 ₽) — два голоса в разговоре ──────────────────────
  143: 'Вальс',
  121: 'Канон',
  60:  'Эхо',
  129: 'Гармония',
  128: 'Серенада',
  135: 'Скерцо',
  138: 'Полонез',
  139: 'Болеро',
  147: 'Пастораль',
  114: 'Каприччио',
  116: 'Вокализ',

  // ── Квартет (4 500 – 6 500 ₽) — камерное многоголосие ────────────────────
  140: 'Соната',
  115: 'Дивертисмент',
  113: 'Аккорд',
  112: 'Каденция',
  141: 'Интермеццо',
  127: 'Унисон',
  57:  'Симфониетта',
  133: 'Сюита',
  134: 'Рапсодия',

  // ── Оркестр (7 000 – 12 000 ₽) — полный состав, парадные композиции ──────
  110: 'Симфония',
  130: 'Концерт',
  19:  'Увертюра',
  124: 'Кантата',
  119: 'Оратория',
  118: 'Поэма',
  111: 'Месса',
  148: 'Хорал',
  144: 'Песнь',
  145: 'Виват',
  146: 'Кода',
  142: 'Бравура',
};

export async function applyBouquetRenamesV2(): Promise<void> {
  try {
    const flag = await prisma.setting.findUnique({ where: { key: FLAG_KEY } });
    if (flag) {
      console.log(`[startup] bouquet rename v2 (${FLAG_KEY}) already applied, skipping`);
      return;
    }

    console.log('[startup] applying one-time bouquet rename v2 → musical-ensemble collections…');
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
      `[startup] bouquet rename v2 done. renamed=${renamed}, unchanged=${unchanged}, missing=${missing}. flag ${FLAG_KEY} set.`,
    );
  } catch (e) {
    // Never crash server boot because of a rename hiccup — log and move on.
    console.error('[startup] applyBouquetRenamesV2 failed:', e);
  }
}
