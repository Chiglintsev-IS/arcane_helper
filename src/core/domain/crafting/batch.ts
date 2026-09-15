import { DomainError } from "@/core/domain/shared/errors";
import { apparatusLimits } from "./apparatus";
import type { Apparatus } from "./apparatus";
import { consumablesOf, startedHours } from "./consumables";
import type { Consumables } from "./consumables";
import { LOWEST_DIFFICULTY } from "./recipe";
import type { RecipeDifficulty } from "./recipe";

const DIFFICULTY_BAND = 5;
const SHORTEST_BATCH_MINUTES = 15;
const LONGER_PER_BAND = 2;

const PORTIONS_PER_BONUS_UNIT = 4;

const PORTIONS_PER_CONSUMABLE_KIT = 5;

/** Время партии зависит только от сложности: одна порция и полная партия варятся одинаково. */
export function batchTimeOf(difficulty: number): number {
  const band = Math.floor((difficulty - LOWEST_DIFFICULTY) / DIFFICULTY_BAND);
  return SHORTEST_BATCH_MINUTES * LONGER_PER_BAND ** band;
}

/**
 * Предел набора — предупреждение, а не запрет: справочник называет работу сверх него невозможной, но
 * разрешить её вправе стол, и последнее слово в приложении всегда за мастером.
 */
function tooHardRu(difficulty: number, hardest: number): string {
  return `Сложность ${difficulty} выше предела набора (${hardest}) — только с разрешения мастера`;
}

function oversizedBatchRu(portions: number, batch: number): string {
  return `Порций заложено ${portions}, а за раз набор держит ${batch} — только с разрешения мастера`;
}

function portionsRefusal(): string {
  return "Рецептурных порций закладывают целое положительное число";
}

export type BatchTimeBand = {
  readonly fromDifficulty: number;
  readonly toDifficulty: number;
  readonly minutes: number;
};

/** Полосы времени: пятёрка сложности — вдвое дольше, и выше предела оснащения полос не бывает. */
export function batchTimeBands(hardest: number): readonly BatchTimeBand[] {
  const bands: BatchTimeBand[] = [];
  for (let from = LOWEST_DIFFICULTY; from <= hardest; from += DIFFICULTY_BAND) {
    bands.push({
      fromDifficulty: from,
      toDifficulty: Math.min(from + DIFFICULTY_BAND - 1, hardest),
      minutes: batchTimeOf(from),
    });
  }
  return bands;
}

export const BATCH_TARIFFS = {
  portionsPerBonusUnit: PORTIONS_PER_BONUS_UNIT,
  portionsPerConsumableKit: PORTIONS_PER_CONSUMABLE_KIT,
} as const;

type BatchWarning = { readonly code: string; readonly reasonRu: string };

export type Batch = {
  readonly difficulty: RecipeDifficulty;
  readonly minutes: number;
  readonly consumables: Consumables;
  readonly consumableKits: number;
  readonly consumablesGold: number;
  readonly units: number;
  readonly warnings: readonly BatchWarning[];
};

export function batchFrom(
  difficulty: RecipeDifficulty,
  apparatus: Apparatus,
  portions: number,
): Batch {
  if (!Number.isInteger(portions) || portions < 1) throw new DomainError(portionsRefusal());

  const limits = apparatusLimits(apparatus);
  const minutes = batchTimeOf(difficulty.total);
  const consumables = consumablesOf(difficulty.total);
  const kits = Math.ceil(portions / PORTIONS_PER_CONSUMABLE_KIT);
  return {
    difficulty,
    minutes,
    consumables,
    consumableKits: kits,
    consumablesGold: consumables.goldPerStartedHour * startedHours(minutes) * kits,
    units: portions + Math.floor(portions / PORTIONS_PER_BONUS_UNIT),
    warnings: [
      ...difficulty.warningsRu.map((reasonRu) => ({ code: "off_handbook", reasonRu })),
      ...(difficulty.total > limits.hardest
        ? [{ code: "over_hardest", reasonRu: tooHardRu(difficulty.total, limits.hardest) }]
        : []),
      ...(portions > limits.batch
        ? [{ code: "over_batch", reasonRu: oversizedBatchRu(portions, limits.batch) }]
        : []),
    ],
  };
}
