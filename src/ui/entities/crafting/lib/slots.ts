import type { IngredientKnowledgeView } from "@/contract/views";

export type PropertySlot = {
  readonly number: number;
  readonly nameRu: string | null;
  readonly dirRu: string | null;
  readonly rarityRu: string | null;
};

/**
 * Четыре слота вида подряд: раскрытое стоит на своём номере, нераскрытое держит своё место пустым.
 * Порядок один и тот же везде, где о виде говорят, — иначе второй слот на одном экране оказался бы
 * третьим на другом.
 */
export function propertySlots(kind: IngredientKnowledgeView): readonly PropertySlot[] {
  return [
    ...kind.properties.map((property) => ({
      number: property.number,
      nameRu: property.nameRu,
      dirRu: property.dirRu,
      rarityRu: property.rarityRu,
    })),
    ...kind.researchNumbers.map((number) => ({
      number,
      nameRu: null,
      dirRu: null,
      rarityRu: null,
    })),
  ].sort((one, other) => one.number - other.number);
}
