/**
 * Проекция знания об ингредиентах: записанные виды и раскрытое у каждого.
 *
 * Запаса здесь нет намеренно: «сколько этого у меня» отвечает сумка, «что я про это знаю» — ремесло,
 * и соединять их незачем — вопросы разные, и задают их в разные минуты игры.
 *
 * Сколько у вида свойств всего, не едет тоже: приложение этого не знает. Потолок правил фактом вида
 * не является, и знаменатель, поехавший отсюда, стал бы обещанием, которого никто не давал.
 */

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
      properties: ingredient.properties.map((property) => ({
        number: property.number,
        nameRu: property.nameRu,
        rarity: property.rarity,
      })),
    })),
  };
}
