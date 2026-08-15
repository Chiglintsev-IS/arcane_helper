/**
 * Прибавки вещи так, как их произносят правила: число один раз и всё, что оно двигает.
 *
 * «Плюс один к Классу Доспеха и всем спасброскам» — одна фраза, а не семь: число сказано один раз, и
 * перечисление идёт после него. Разобранное по величинам, оно приезжает семью числами, из которых
 * целое приходится собирать обратно, — а тот, кому перечень не помещается, обрывает его и обещает
 * меньше, чем вещь даёт.
 *
 * Семейство величин — второй способ той же экономии: набор, о котором правила говорят целиком, зовут
 * одним именем, а не столькими, сколько в нём величин.
 *
 * Свёрнутое живёт здесь, у владельца этих чисел: сколько чисел вещь называет и что считать
 * семейством — правило игры, и второй ответ на тот же вопрос разошёлся бы с первым молча.
 */

import { ABILITIES, saveStatId, type StatId } from "@/core/domain/shared/stats";

type StatFamilyId = "saves";

/** Состав семейства: имя целого действует, только пока названы все его величины. */
const STAT_FAMILIES: readonly {
  readonly id: StatFamilyId;
  readonly members: readonly StatId[];
}[] = [{ id: "saves", members: ABILITIES.map(saveStatId) }];

type StatBonus = { readonly stat: StatId; readonly value: number };

/** То, что число двигает: одна величина или целое семейство. */
type BonusTarget =
  | { readonly kind: "stat"; readonly id: StatId }
  | { readonly kind: "family"; readonly id: StatFamilyId };

/** Прибавка целиком: своё число и всё, что им названо. */
type BonusFact = { readonly value: number; readonly targets: readonly BonusTarget[] };

/**
 * Прибавка, равная у всех величин семейства; нет вовсе — семейство названо не целиком или числа в
 * нём разные, и тогда именем целого его не зовут.
 */
function familyValue(bonuses: readonly StatBonus[], members: readonly StatId[]): number | undefined {
  const values = members.map((stat) => bonuses.find((bonus) => bonus.stat === stat)?.value);
  const [first] = values;
  if (first === undefined) return undefined;
  return values.every((value) => value === first) ? first : undefined;
}

function namedFamilies(bonuses: readonly StatBonus[]) {
  return STAT_FAMILIES.flatMap((family) => {
    const value = familyValue(bonuses, family.members);
    return value === undefined ? [] : [{ ...family, value }];
  });
}

type NamedBonus = { readonly target: BonusTarget; readonly value: number };

/**
 * Прибавки по именам: своя величина — своё имя, а названное целиком семейство — одно имя на месте
 * первой своей величины. Порядок величин при этом сохраняется: он принадлежит словарю величин, и
 * переставлять его свёртке не за чем.
 */
function namedBonuses(bonuses: readonly StatBonus[]): readonly NamedBonus[] {
  const families = namedFamilies(bonuses);
  return bonuses.flatMap((bonus, index): NamedBonus[] => {
    const family = families.find((candidate) => candidate.members.includes(bonus.stat));
    if (family === undefined) {
      return [{ target: { kind: "stat", id: bonus.stat }, value: bonus.value }];
    }
    const firstOfFamily = bonuses.findIndex((other) => family.members.includes(other.stat));
    return index === firstOfFamily
      ? [{ target: { kind: "family", id: family.id }, value: family.value }]
      : [];
  });
}

/**
 * Прибавки вещи фактами: сколько разных чисел вещь называет, столько и фактов, и при каждом стоит
 * всё, что оно двигает. Число стоит на месте первой своей величины.
 */
export function bonusFactsOf(bonuses: readonly StatBonus[]): readonly BonusFact[] {
  const named = namedBonuses(bonuses);
  return [...new Set(named.map((bonus) => bonus.value))].map((value) => ({
    value,
    targets: named.filter((bonus) => bonus.value === value).map((bonus) => bonus.target),
  }));
}
