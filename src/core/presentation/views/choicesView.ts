import type { ChoicesView } from "@/contract/views";

import { RUNE_TARGETS } from "@/core/domain/arcana/runes";
import {
  EXHAUSTION_STEPS,
  MAXIMUM_ABILITY_SCORE,
  MINIMUM_ABILITY_SCORE,
} from "@/core/domain/character/abilities";
import { CREATURE_SIZES } from "@/core/domain/character/schema";
import { APPARATUS_GRADES } from "@/core/domain/crafting/apparatus";
import { RECIPE_CHOICES } from "@/core/domain/crafting/recipe";
import { SKILL_TRAINING } from "@/core/domain/character/skills";
import { ALCHEMY_DIRECTIONS } from "@/core/domain/items/ingredient";
import { ITEM_KINDS } from "@/core/domain/items/schema";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import { CURRENCIES } from "@/core/domain/shared/schema";
import { STATS } from "@/core/domain/shared/stats";

export function toChoicesView(): ChoicesView {
  return {
    stats: STATS.map((stat) => ({
      id: stat.id,
      kind: stat.kind,
      ...(stat.of === undefined ? {} : { of: stat.of }),
    })),
    creatureSizes: [...CREATURE_SIZES],
    itemKinds: [...ITEM_KINDS],
    currencies: [...CURRENCIES],
    skillTrainings: [...SKILL_TRAINING],
    runeTargets: [...RUNE_TARGETS],
    exhaustionSteps: [...EXHAUSTION_STEPS],
    characterLevel: { minimum: MINIMUM_CHARACTER_LEVEL, maximum: MAXIMUM_CHARACTER_LEVEL },
    abilityScore: { minimum: MINIMUM_ABILITY_SCORE, maximum: MAXIMUM_ABILITY_SCORE },
    apparatusGrades: [...APPARATUS_GRADES],
    alchemyDirections: [...ALCHEMY_DIRECTIONS],
    recipeForm: RECIPE_CHOICES,
  };
}
