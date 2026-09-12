import { apparatusEntries, hardestPossible } from "./apparatus";
import type { ApparatusEntry } from "./apparatus";
import { BATCH_TARIFFS, batchTimeBands } from "./batch";
import type { BatchTimeBand } from "./batch";
import { consumableBands } from "./consumables";
import type { ConsumableBand } from "./consumables";
import { FEWEST_KINDS, MOST_KINDS } from "./crafting";
import { mishapBands } from "./development";
import type { MishapBand } from "./development";
import { RECIPE_TARIFFS, tierSteps } from "./recipe";
import type { TierStep } from "./recipe";
import { researchSteps } from "./research";
import type { ResearchStep } from "./research";

/**
 * Справочник — те же таблицы, по которым ремесло считает: второго перечня чисел у стола нет, и
 * прочитанное игроком не может разойтись с тем, что назовёт верстак.
 */
type AlchemyHandbook = {
  readonly apparatus: readonly ApparatusEntry[];
  readonly research: readonly ResearchStep[];
  readonly consumables: readonly ConsumableBand[];
  readonly batchTimes: readonly BatchTimeBand[];
  readonly tiers: readonly TierStep[];
  readonly mishaps: readonly MishapBand[];
  readonly tariffs: {
    readonly fewestKinds: number;
    readonly mostKinds: number;
    readonly base: number;
    readonly lowest: number;
    readonly additionalEffect: number;
    readonly suppression: number;
    readonly mostLimitationRelief: number;
    readonly portionsPerBonusUnit: number;
    readonly portionsPerConsumableKit: number;
  };
};

export function alchemyHandbook(): AlchemyHandbook {
  return {
    apparatus: apparatusEntries(),
    research: researchSteps(),
    consumables: consumableBands(RECIPE_TARIFFS.lowest),
    batchTimes: batchTimeBands(hardestPossible()),
    tiers: tierSteps(FEWEST_KINDS, MOST_KINDS),
    mishaps: mishapBands(),
    tariffs: {
      fewestKinds: FEWEST_KINDS,
      mostKinds: MOST_KINDS,
      base: RECIPE_TARIFFS.base,
      lowest: RECIPE_TARIFFS.lowest,
      additionalEffect: RECIPE_TARIFFS.additionalEffect,
      suppression: RECIPE_TARIFFS.suppression,
      mostLimitationRelief: RECIPE_TARIFFS.mostLimitationRelief,
      portionsPerBonusUnit: BATCH_TARIFFS.portionsPerBonusUnit,
      portionsPerConsumableKit: BATCH_TARIFFS.portionsPerConsumableKit,
    },
  };
}
