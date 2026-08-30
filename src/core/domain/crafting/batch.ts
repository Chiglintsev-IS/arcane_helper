import { DomainError } from "@/core/domain/shared/errors";
import { signed } from "@/shared/language";
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

function batchMinutes(difficulty: number): number {
  const band = Math.floor((difficulty - LOWEST_DIFFICULTY) / DIFFICULTY_BAND);
  return SHORTEST_BATCH_MINUTES * LONGER_PER_BAND ** band;
}

function tooHardRefusal(difficulty: RecipeDifficulty, hardest: number): string {
  const gathered = difficulty.parts
    .filter((part) => part.modifier > 0)
    .sort((one, other) => other.modifier - one.modifier)
    .map((part) => `${part.nameRu} ${signed(part.modifier)}`)
    .join(", ");
  return `Сложность ${difficulty.total} выше предела оснащения ${hardest}. Набрано: ${gathered}`;
}

function portionsRefusal(): string {
  return "Рецептурных порций закладывают целое положительное число";
}

function oversizedBatchRefusal(portions: number, batch: number): string {
  return `Заложено порций: ${portions}, а предел партии этого оснащения — ${batch}`;
}

export type Batch = {
  readonly difficulty: RecipeDifficulty;
  readonly minutes: number;
  readonly consumables: Consumables;
  readonly consumablesGold: number;
  readonly units: number;
};

export function batchFrom(
  difficulty: RecipeDifficulty,
  apparatus: Apparatus,
  portions: number,
): Batch {
  const limits = apparatusLimits(difficulty.directions, apparatus);
  if (difficulty.total > limits.hardest) {
    throw new DomainError(tooHardRefusal(difficulty, limits.hardest));
  }
  if (!Number.isInteger(portions) || portions < 1) throw new DomainError(portionsRefusal());
  if (portions > limits.batch) throw new DomainError(oversizedBatchRefusal(portions, limits.batch));

  const minutes = batchMinutes(difficulty.total);
  const consumables = consumablesOf(difficulty.total);
  return {
    difficulty,
    minutes,
    consumables,
    consumablesGold:
      consumables.goldPerStartedHour *
      startedHours(minutes) *
      Math.ceil(portions / PORTIONS_PER_CONSUMABLE_KIT),
    units: portions + Math.floor(portions / PORTIONS_PER_BONUS_UNIT),
  };
}
