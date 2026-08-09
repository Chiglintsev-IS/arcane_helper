/**
 * Проекция перечней выбора: из чего игрок выбирает и в каких границах набирает.
 *
 * Единственная проекция, которая состояния не читает, и это не изъян, а её смысл: список того, что
 * бывает, у персонажа не спрашивают. Перечни едут теми же, которыми пользуются сами правила, —
 * пополнение списка доходит до поля выбора без единой правки на другой стороне, а второй список тех
 * же слов разошёлся бы с первым молча.
 *
 * Подписей здесь нет: слово к перечню выбирает показывающий. Границы едут рядом с перечнями, потому
 * что отвечают на тот же вопрос — что поле вправе предложить; проверяет набранное владелец
 * инварианта, а не тот, кто предел показал.
 */

import type { ChoicesView } from "@/contract/views";

import { RUNE_TARGETS } from "@/core/domain/arcana/runes";
import {
  EXHAUSTION_STEPS,
  MAXIMUM_ABILITY_SCORE,
  MINIMUM_ABILITY_SCORE,
} from "@/core/domain/character/abilities";
import { CREATURE_SIZES } from "@/core/domain/character/schema";
import { SKILL_TRAINING } from "@/core/domain/character/skills";
import { ITEM_KINDS } from "@/core/domain/items/schema";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import { CURRENCIES } from "@/core/domain/shared/schema";
import { ARMOR_CATEGORIES, STATS } from "@/core/domain/shared/stats";

export function toChoicesView(): ChoicesView {
  return {
    stats: STATS.map((stat) => ({
      id: stat.id,
      kind: stat.kind,
      ...(stat.of === undefined ? {} : { of: stat.of }),
    })),
    creatureSizes: [...CREATURE_SIZES],
    itemKinds: [...ITEM_KINDS],
    armorCategories: [...ARMOR_CATEGORIES],
    currencies: [...CURRENCIES],
    skillTrainings: [...SKILL_TRAINING],
    runeTargets: [...RUNE_TARGETS],
    exhaustionSteps: [...EXHAUSTION_STEPS],
    characterLevel: { minimum: MINIMUM_CHARACTER_LEVEL, maximum: MAXIMUM_CHARACTER_LEVEL },
    abilityScore: { minimum: MINIMUM_ABILITY_SCORE, maximum: MAXIMUM_ABILITY_SCORE },
  };
}
