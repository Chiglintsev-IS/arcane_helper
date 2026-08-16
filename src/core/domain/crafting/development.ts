/**
 * Проверка разработки: бросок игрока против сложности рецепта.
 *
 * Кость кидает игрок, приложение принимает выпавшее и складывает. Своего бонуса у ремесла нет:
 * бонус мастерства и модификатор характеристики — числа листа, и приходят они сюда доводом. Ремесло
 * знает лишь то, чего лист не знает, — какому направлению алхимик обучен и какое направление в
 * работе самое слабое.
 *
 * Гибрид идёт одной проверкой, и бонус ей достаётся наименьший среди задействованных направлений:
 * рецепт, куда затесалось свойство неизученного направления, роняет проверку целиком.
 */

import type { AlchemyDirection } from "@/core/domain/catalog/alchemy";
import { DomainError } from "@/core/domain/shared/errors";
import type { Ability } from "@/core/domain/shared/stats";

/** Характеристика алхимических проверок: справочник называет Интеллект. */
export const ALCHEMY_ABILITY: Ability = "intelligence";

/** Кость проверки и кость последствий: справочник называет обе. */
const CHECK_DIE_FACES = 20;
const MISHAP_DIE_FACES = 6;
const NATURAL_ONE = 1;

/** Последствия критического провала по d6. */
const MISHAPS: readonly string[] = [
  "Реакция гаснет без дополнительных последствий.",
  "Реакция гаснет без дополнительных последствий.",
  "Повреждён сменный элемент оснащения; ремонт стоит 5% цены набора или модуля.",
  "Алхимик подвергается одному случайному эффекту смеси на обычной ступени.",
  "Смесь воздействует на область радиусом 1 метр.",
  "Повреждается оборудование, а алхимик подвергается случайному эффекту смеси.",
];

/** Числа листа, которые проверка складывает: своих у ремесла нет. */
export type CheckNumbers = {
  readonly proficiencyBonus: number;
  readonly abilityModifier: number;
};

/**
 * Чем работа прибавляется к броску и что мешает прибавиться сильнее.
 *
 * Необученные направления названы отдельно, а не выведены из числа: игрок обязан увидеть до броска,
 * почему бонус ниже привычного, а «на три меньше» само по себе на этот вопрос не отвечает.
 */
export type DevelopmentCheck = {
  readonly bonus: number;
  readonly unstudied: readonly AlchemyDirection[];
};

export function developmentCheck(
  directions: readonly AlchemyDirection[],
  studied: readonly AlchemyDirection[],
  numbers: CheckNumbers,
): DevelopmentCheck {
  const bonuses = directions.map(
    (direction) =>
      numbers.abilityModifier + (studied.includes(direction) ? numbers.proficiencyBonus : 0),
  );
  return {
    bonus: Math.min(...bonuses),
    unstudied: directions.filter((direction) => !studied.includes(direction)),
  };
}

function impossibleRollRefusal(faces: number, rolled: number): string {
  return `На d${faces} столько не выпадает: ${rolled}`;
}

function missingMishapRefusal(): string {
  return `Натуральная единица: назовите выпавшее на d${MISHAP_DIE_FACES} — последствие называет справочник`;
}

function assertCheckRoll(rolled: number): void {
  if (!Number.isInteger(rolled) || rolled < NATURAL_ONE || rolled > CHECK_DIE_FACES) {
    throw new DomainError(impossibleRollRefusal(CHECK_DIE_FACES, rolled));
  }
}

/** Последствие аварии по выпавшему; выпасть такого не могло — отказ с причиной. */
function mishapOf(rolled: number): string {
  const found = MISHAPS[rolled - NATURAL_ONE];
  if (found === undefined) throw new DomainError(impossibleRollRefusal(MISHAP_DIE_FACES, rolled));
  return found;
}

/**
 * Чем кончилась проверка разработки.
 *
 * Натуральная единица — не просто провал: рецепт не создаётся, и происходит алхимическая авария,
 * последствие которой называет своя таблица. Натуральная двадцать сама по себе успеха не даёт:
 * справочник награждает её только при успешном результате.
 */
export type DevelopmentOutcome = {
  readonly rolled: number;
  readonly bonus: number;
  readonly total: number;
  readonly success: boolean;
  readonly rewarded: boolean;
  /** Последствие аварии; нет вовсе — аварии не случилось. */
  readonly mishapRu?: string;
};

export function developmentOutcome(input: {
  readonly rolled: number;
  readonly mishapRolled: number | undefined;
  readonly check: DevelopmentCheck;
  readonly difficulty: number;
}): DevelopmentOutcome {
  assertCheckRoll(input.rolled);
  const total = input.rolled + input.check.bonus;
  const scored = { rolled: input.rolled, bonus: input.check.bonus, total };

  if (input.rolled === NATURAL_ONE) {
    if (input.mishapRolled === undefined) throw new DomainError(missingMishapRefusal());
    return { ...scored, success: false, rewarded: false, mishapRu: mishapOf(input.mishapRolled) };
  }

  const success = total >= input.difficulty;
  return { ...scored, success, rewarded: success && input.rolled === CHECK_DIE_FACES };
}
