import type { CraftingView } from "@/contract/views";

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { SMITHING } from "@/core/domain/crafting/crafts";

export function toCraftingView(character: CharacterState): CraftingView {
  const root = Character.of(character);
  return {
    workshop: { apparatusRu: root.crafting.apparatus ?? null },
    smithing: { ...SMITHING },
    ingredients: root.items.ingredients.map((item) => {
      const alchemy = root.items.alchemyOf(item.id);
      return {
        itemId: item.id,
        nameRu: item.nameRu,
        inBag: root.equipment.bagCount(item.id),
        propertiesExhausted: alchemy.propertiesExhausted,
        observations: alchemy.observations.map((seen) => ({ ...seen })),
        properties: alchemy.properties.map((property) => ({ ...property })),
      };
    }),
  };
}
