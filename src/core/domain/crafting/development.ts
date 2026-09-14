import type { Ability } from "@/core/domain/shared/stats";

export const ALCHEMY_ABILITY: Ability = "intelligence";

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
