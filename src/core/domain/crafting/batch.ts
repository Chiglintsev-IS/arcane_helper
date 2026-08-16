/**
 * Партия: во что обходится рецепт этой сложности и сколько состава из него выйдет.
 *
 * Одна единица и полная допустимая партия требуют одного и того же времени, поэтому закладывать
 * помалу невыгодно, а закладывать сверх предела оснащения нельзя вовсе.
 */

import { DomainError } from "@/core/domain/shared/errors";
import { signed } from "@/shared/language";
import { apparatusLimits } from "./apparatus";
import type { Apparatus } from "./apparatus";
import { LOWEST_DIFFICULTY } from "./recipe";
import type { RecipeDifficulty } from "./recipe";

/** Время партии: полоса сложности шириной в пять, и каждая следующая полоса вдвое длиннее. */
const DIFFICULTY_BAND = 5;
const SHORTEST_BATCH_MINUTES = 15;
const LONGER_PER_BAND = 2;
const MINUTES_PER_HOUR = 60;

/** Одна единица сверх каждых четырёх заложенных порций: на стенках сосудов теряется меньше. */
const PORTIONS_PER_BONUS_UNIT = 4;

/** Один часовой комплект расходников обслуживает столько рецептурных порций. */
const PORTIONS_PER_CONSUMABLE_KIT = 5;

type Consumables = { readonly nameRu: string; readonly goldPerStartedHour: number };

/** Класс расходников по итоговой сложности и цена его комплекта за начатый час. */
function consumablesOf(difficulty: number): Consumables {
  if (difficulty <= 19) return { nameRu: "Обычные", goldPerStartedHour: 1 };
  if (difficulty <= 29) return { nameRu: "Очищенные", goldPerStartedHour: 3 };
  if (difficulty <= 39) return { nameRu: "Высокоточные", goldPerStartedHour: 10 };
  return { nameRu: "Экзотические", goldPerStartedHour: 30 };
}

function batchMinutes(difficulty: number): number {
  const band = Math.floor((difficulty - LOWEST_DIFFICULTY) / DIFFICULTY_BAND);
  return SHORTEST_BATCH_MINUTES * LONGER_PER_BAND ** band;
}

/**
 * Отказ, называющий не только предел, но и то, чем набрано лишнее.
 *
 * «Слишком сложно» не отвечает на вопрос, ради которого рецепт и считают: что убрать, чтобы стало
 * возможно. Поправки названы от самой дорогой — с неё и начинают резать.
 */
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

/**
 * Что выйдет из заложенной партии: время, расходники и число готовых единиц.
 *
 * Расходники считаются за каждый начатый час и за каждые начатые пять рецептурных порций: часовой
 * комплект обслуживает пять, шестой порции нужен второй комплект.
 */
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
      Math.ceil(minutes / MINUTES_PER_HOUR) *
      Math.ceil(portions / PORTIONS_PER_CONSUMABLE_KIT),
    units: portions + Math.floor(portions / PORTIONS_PER_BONUS_UNIT),
  };
}
