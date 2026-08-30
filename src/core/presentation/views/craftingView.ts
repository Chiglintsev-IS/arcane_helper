import type { CraftingView } from "@/contract/views";

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { ALCHEMY_DIRECTIONS } from "@/core/domain/catalog/alchemy";

export function toCraftingView(character: CharacterState): CraftingView {
  const crafting = Character.of(character).crafting;
  return {
    workshop: {
      apparatus: ALCHEMY_DIRECTIONS.flatMap((direction) => {
        const gradeRu = crafting.apparatus[direction];
        return gradeRu === undefined ? [] : [{ direction, gradeRu }];
      }),
      studiedDirections: ALCHEMY_DIRECTIONS.filter((direction) => crafting.studies(direction)),
    },
    ingredients: crafting.all.map((ingredient) => ({
      nameRu: ingredient.nameRu,
      propertiesExhausted: ingredient.propertiesExhausted,
      properties: ingredient.properties.map((property) => ({
        number: property.number,
        nameRu: property.nameRu,
        rarity: property.rarity,
      })),
    })),
  };
}
