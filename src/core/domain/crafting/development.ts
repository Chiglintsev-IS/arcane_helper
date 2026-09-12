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

export type MishapBand = {
  readonly fromRolled: number;
  readonly toRolled: number;
  readonly textRu: string;
};

/** Соседние грани с одним последствием стоят одной строкой: так их и читает справочник. */
export function mishapBands(): readonly MishapBand[] {
  return MISHAPS.reduce<readonly MishapBand[]>((bands, textRu, index) => {
    const rolled = index + NATURAL_ONE;
    const last = bands.at(-1);
    return last !== undefined && last.textRu === textRu
      ? [...bands.slice(0, -1), { ...last, toRolled: rolled }]
      : [...bands, { fromRolled: rolled, toRolled: rolled, textRu }];
  }, []);
}

export type CheckNumbers = {
  readonly proficiencyBonus: number;
  readonly abilityModifier: number;
};

export type DevelopmentCheck = {
  readonly bonus: number;
};

/** Алхимией Торн владеет: бонус мастерства идёт к каждой проверке разработки. */
export function developmentCheck(numbers: CheckNumbers): DevelopmentCheck {
  return { bonus: numbers.abilityModifier + numbers.proficiencyBonus };
}

/** Второй кубик нужен только аварии: её вызывает натуральная единица, и ничто больше. */
export function mishapAwaited(rolled: number | undefined): boolean {
  return rolled === NATURAL_ONE;
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
