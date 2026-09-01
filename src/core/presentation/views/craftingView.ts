import type { CraftingView } from "@/contract/views";

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { ALCHEMY_DIRECTIONS } from "@/core/domain/catalog/alchemy";
import { SMITHING } from "@/core/domain/crafting/crafts";
import { closedDirections } from "@/core/domain/crafting/forbidden";

export function toCraftingView(character: CharacterState): CraftingView {
  const root = Character.of(character);
  const crafting = root.crafting;
  return {
    workshop: {
      apparatus: ALCHEMY_DIRECTIONS.flatMap((direction) => {
        const gradeRu = crafting.apparatus[direction];
        return gradeRu === undefined ? [] : [{ direction, gradeRu }];
      }),
      studiedDirections: ALCHEMY_DIRECTIONS.filter((direction) => crafting.studies(direction)),
      closedDirections: closedDirections().map((closed) => ({ ...closed })),
    },
    smithing: { ...SMITHING },
    ingredients: root.items.ingredients.map((item) => {
      const alchemy = root.items.alchemyOf(item.id);
      return {
        itemId: item.id,
        nameRu: item.nameRu,
        inBag: root.equipment.bagCount(item.id),
        propertiesExhausted: alchemy.propertiesExhausted,
        observations: alchemy.observations.map((seen) => ({ ...seen })),
        properties: alchemy.properties.map((property) => {
          const rarity = crafting.rarityOf(property.nameRu);
          return {
            number: property.number,
            nameRu: property.nameRu,
            ...(rarity === undefined ? {} : { rarity }),
          };
        }),
      };
    }),
  };
}
