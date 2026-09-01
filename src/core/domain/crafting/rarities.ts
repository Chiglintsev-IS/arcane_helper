import { z } from "zod";

import { ALCHEMICAL_RARITIES, isAlchemicalPropertyName } from "@/core/domain/catalog/alchemy";
import type { AlchemicalPropertyName, AlchemicalRarity } from "@/core/domain/catalog/alchemy";
import { parsedOrRefused } from "@/core/domain/shared/schema";

/**
 * Редкость — свойство свойства, а не вида: справочник её не печатает, называет стол, и названная
 * однажды она годится любому ингредиенту, у которого это свойство раскрыто.
 */
const namedRarityFields = z.object({
  nameRu: z.string().refine(isAlchemicalPropertyName, {
    error: (issue) => `свойства «${String(issue.input)}» нет в справочнике`,
  }),
  rarity: z.enum(ALCHEMICAL_RARITIES),
});

export type NamedRarity = z.infer<typeof namedRarityFields>;

export function namedRarityOf(value: unknown): NamedRarity {
  return parsedOrRefused(namedRarityFields, value, "названную редкость");
}

export function rarityAmong(
  named: readonly NamedRarity[],
  nameRu: AlchemicalPropertyName,
): AlchemicalRarity | undefined {
  return named.find((one) => one.nameRu === nameRu)?.rarity;
}

export function withRarityNamed(
  named: readonly NamedRarity[],
  nameRu: AlchemicalPropertyName,
  rarity: AlchemicalRarity,
): readonly NamedRarity[] {
  return [...named.filter((one) => one.nameRu !== nameRu), { nameRu, rarity }];
}

export const PROPERTY_RARITY_FIELDS = {
  propertyRarities: z
    .array(namedRarityFields)
    .transform((named) =>
      named.reduce<readonly NamedRarity[]>(
        (kept, one) => withRarityNamed(kept, one.nameRu, one.rarity),
        [],
      ),
    )
    .default([]),
};
