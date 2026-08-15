/**
 * Семейства величин: наборы, о которых правила говорят целиком.
 *
 * «Плюс один ко всем спасброскам» — одно правило, а не шесть, и за столом его так и произносят.
 * Разложенное по величинам, оно приезжает перечнем, из которого целое приходится собирать обратно, —
 * а тот, кому перечень не помещается, обрывает его и обещает меньше, чем вещь даёт.
 *
 * Свёрнутое имя живёт здесь, у владельца этих чисел: что считать семейством и когда прибавка названа
 * его именем — правило игры, и второй ответ на тот же вопрос разошёлся бы с первым молча.
 */

import { ABILITIES, saveStatId, type StatId } from "@/core/domain/shared/stats";

type StatFamilyId = "saves";

/** Состав семейства: имя целого действует, только пока названы все его величины. */
const STAT_FAMILIES: readonly {
  readonly id: StatFamilyId;
  readonly members: readonly StatId[];
}[] = [{ id: "saves", members: ABILITIES.map(saveStatId) }];

type StatBonus = { readonly stat: StatId; readonly value: number };

/** Прибавка к одной величине или к целому семейству: имя факта и его число. */
type BonusFact =
  | { readonly kind: "stat"; readonly id: StatId; readonly value: number }
  | { readonly kind: "family"; readonly id: StatFamilyId; readonly value: number };

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

/**
 * Прибавки вещи фактами: своя величина — свой факт, а названное целиком семейство — один факт на
 * месте первой своей величины. Порядок прибавок при этом сохраняется: он принадлежит словарю
 * величин, и переставлять его свёртке не за чем.
 */
export function bonusFactsOf(bonuses: readonly StatBonus[]): readonly BonusFact[] {
  const families = namedFamilies(bonuses);
  return bonuses.flatMap((bonus, index): BonusFact[] => {
    const family = families.find((candidate) => candidate.members.includes(bonus.stat));
    if (family === undefined) return [{ kind: "stat", id: bonus.stat, value: bonus.value }];
    const firstOfFamily = bonuses.findIndex((other) => family.members.includes(other.stat));
    return index === firstOfFamily ? [{ kind: "family", id: family.id, value: family.value }] : [];
  });
}
