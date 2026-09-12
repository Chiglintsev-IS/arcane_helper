import type { CraftingView } from "@/contract/views";

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { SMITHING } from "@/core/domain/crafting/crafts";
import { alchemyHandbook } from "@/core/domain/crafting/handbook";

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
    mishaps: copied(handbook.mishaps),
    tariffs: { ...handbook.tariffs },
  };
}

export function toCraftingView(character: CharacterState): CraftingView {
  const root = Character.of(character);
  return {
    workshop: { apparatusRu: root.crafting.apparatus ?? null },
    smithing: { ...SMITHING },
    handbook: toHandbookView(),
    ingredients: root.items.ingredients.map((item) => {
      const alchemy = root.items.alchemyOf(item.id);
      const inBag = root.equipment.bagCount(item.id);
      return {
        itemId: item.id,
        nameRu: item.nameRu,
        inBag,
        piecesPerPortion: alchemy.piecesPerPortion,
        portionsInBag: root.items.portionsFromPieces(item.id, inBag),
        shortageRu: root.equipment.shortageRu(
          item.id,
          root.items.piecesForPortions(item.id, 1),
        ),
        researchNumbers: [...root.items.unrevealedNumbers(item.id)],
        propertiesExhausted: alchemy.propertiesExhausted,
        observations: alchemy.observations.map((seen) => ({ ...seen })),
        properties: alchemy.properties.map((property) => ({ ...property })),
      };
    }),
  };
}
