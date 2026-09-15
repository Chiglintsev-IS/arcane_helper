import type { CraftingView, KnownRecipeView } from "@/contract/views";

import { coinsView } from "@/core/presentation/views/coins";
import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { apparatusLimits } from "@/core/domain/crafting/apparatus";
import { batchTimeOf } from "@/core/domain/crafting/batch";
import { consumablesOf } from "@/core/domain/crafting/consumables";
import { SMITHING } from "@/core/domain/crafting/crafts";
import { alchemyHandbook } from "@/core/domain/crafting/handbook";
import type { RecipeFormula } from "@/core/domain/crafting/recipe";
import { FIND_CHECK_RU, GATHER_CHECK_RU } from "@/core/domain/items/ingredient";
import { refusalOf } from "@/core/domain/shared/errors";
import { mixtureKinds } from "@/core/application/useCases/crafting";

function copied<TRow extends object>(rows: readonly TRow[]): TRow[] {
  return rows.map((row) => ({ ...row }));
}

function toHandbookView(): CraftingView["handbook"] {
  const handbook = alchemyHandbook();
  return {
    apparatus: copied(handbook.apparatus),
    research: copied(handbook.research),
    consumables: copied(handbook.consumables),
    batchTimes: copied(handbook.batchTimes),
    tiers: copied(handbook.tiers),
    rarities: copied(handbook.rarities),
    mishaps: copied(handbook.mishaps),
    effects: handbook.effects.map((group) => ({ dirRu: group.dirRu, namesRu: [...group.namesRu] })),
    checks: { findRu: FIND_CHECK_RU, gatherRu: GATHER_CHECK_RU },
    tariffs: { ...handbook.tariffs },
  };
}

/** Меньше порции алхимия не берёт: она и есть единица счёта запаса. */
const ONE_PORTION = 1;

const NO_NUMBERS = {
  difficulty: null,
  unpriced: false,
  minutes: null,
  consumablesRu: null,
  goldPerStartedHour: null,
} as const;

/**
 * Рецепт живёт дольше своих видов: вещь можно убрать, а раскрытое — снять, и тогда цену замысла
 * назвать нечем. Запись при этом остаётся в книге, и вместо чисел она называет причину.
 */
function toRecipeView(root: Character, formula: RecipeFormula): KnownRecipeView {
  const named = formula.kinds.map((itemId) => root.items.find(itemId)?.nameRu ?? itemId);
  const copy = {
    kinds: [...formula.kinds],
    mainProperty: formula.mainProperty,
    mainRarity: formula.mainRarity,
    duration: formula.duration,
    onset: formula.onset,
    fullRepeats: formula.fullRepeats,
    reach: formula.reach,
    application: formula.application,
    resistance: formula.resistance,
    purified: formula.purified,
    suppressed: formula.suppressed.map((one) => ({ ...one })),
    limitations: [...formula.limitations],
  };

  try {
    const cost = root.crafting.costOf(mixtureKinds(root.items, formula.kinds), formula);
    const minutes = batchTimeOf(cost.total);
    const consumables = consumablesOf(cost.total);
    return {
      nameRu: cost.mainRu,
      kindsRu: named,
      difficulty: cost.total,
      unpriced: cost.unpriced,
      minutes,
      consumablesRu: consumables.nameRu,
      goldPerStartedHour: consumables.goldPerStartedHour,
      refusalRu: null,
      formula: copy,
    };
  } catch (error: unknown) {
    return {
      nameRu: formula.mainProperty ?? named.join(", "),
      kindsRu: named,
      ...NO_NUMBERS,
      refusalRu: refusalOf(error),
      formula: copy,
    };
  }
}

export function toCraftingView(character: CharacterState): CraftingView {
  const root = Character.of(character);
  const limits = apparatusLimits(root.crafting.apparatus);
  return {
    workshop: {
      apparatusRu: root.crafting.apparatus ?? null,
      hardest: limits.hardest,
      batch: limits.batch,
      stationary: limits.stationary,
    },
    smithing: { ...SMITHING },
    handbook: toHandbookView(),
    recipes: root.crafting.recipes.map((formula) => toRecipeView(root, formula)),
    ingredients: root.items.ingredients.map((item) => {
      const alchemy = root.items.alchemyOf(item.id);
      return {
        itemId: item.id,
        nameRu: item.nameRu,
        portionsInBag: root.equipment.bagCount(item.id),
        shortageRu: root.equipment.shortageRu(item.id, ONE_PORTION),
        researchNumbers: [...root.items.unrevealedNumbers(item.id)],
        notes: item.notes.map((note) => ({ ...note })),
        properties: alchemy.properties.map((property) => ({
          number: property.number,
          nameRu: property.nameRu,
          dirRu: property.dirRu ?? null,
          rarityRu: property.rarityRu ?? null,
        })),
        findDc: alchemy.findDc ?? null,
        gatherDc: alchemy.gatherDc ?? null,
        yieldRu: alchemy.yieldRu ?? null,
        portionRu: alchemy.portionRu ?? null,
        price: item.price === undefined ? null : coinsView(item.price),
      };
    }),
  };
}
