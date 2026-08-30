import type { AlchemyDirection } from "@/core/domain/catalog/alchemy";
import { DomainError } from "@/core/domain/shared/errors";
import type { Ability } from "@/core/domain/shared/stats";
import { CHECK_DIE_RU, MISHAP_DIE_RU } from "@/shared/language";

export const ALCHEMY_ABILITY: Ability = "intelligence";

const CHECK_DIE_FACES = 20;
const NATURAL_ONE = 1;

const MISHAPS: readonly string[] = [
  "Реакция гаснет без дополнительных последствий.",
  "Реакция гаснет без дополнительных последствий.",
  "Повреждён сменный элемент оснащения; ремонт стоит 5% цены набора или модуля.",
  "Алхимик подвергается одному случайному эффекту смеси на обычной ступени.",
  "Смесь воздействует на область радиусом 1 метр.",
  "Повреждается оборудование, а алхимик подвергается случайному эффекту смеси.",
];

export type CheckNumbers = {
  readonly proficiencyBonus: number;
  readonly abilityModifier: number;
};

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

function impossibleRollRefusal(dieRu: string, rolled: number): string {
  return `На ${dieRu} столько не выпадает: ${rolled}`;
}

function missingMishapRefusal(): string {
  return `Натуральная единица: назовите выпавшее на ${MISHAP_DIE_RU} — последствие называет справочник`;
}

function assertCheckRoll(rolled: number): void {
  if (!Number.isInteger(rolled) || rolled < NATURAL_ONE || rolled > CHECK_DIE_FACES) {
    throw new DomainError(impossibleRollRefusal(CHECK_DIE_RU, rolled));
  }
}

function mishapOf(rolled: number): string {
  const found = MISHAPS[rolled - NATURAL_ONE];
  if (found === undefined) throw new DomainError(impossibleRollRefusal(MISHAP_DIE_RU, rolled));
  return found;
}

export type DevelopmentOutcome = {
  readonly rolled: number;
  readonly bonus: number;
  readonly total: number;
  readonly success: boolean;
  readonly rewarded: boolean;
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
