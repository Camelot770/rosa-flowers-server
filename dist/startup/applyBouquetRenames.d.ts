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
export declare function applyBouquetRenames(): Promise<void>;
//# sourceMappingURL=applyBouquetRenames.d.ts.map