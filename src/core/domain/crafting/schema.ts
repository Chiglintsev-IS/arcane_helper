import { z } from "zod";

import { ALCHEMY_DIRECTIONS } from "@/core/domain/catalog/alchemy";
import type { AlchemyDirection } from "@/core/domain/catalog/alchemy";
import { parsedOrRefused } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";
import { APPARATUS_GRADES } from "./apparatus";
import { PROPERTY_RARITY_FIELDS } from "./rarities";
import { KNOWN_RECIPE_FIELDS } from "./recipe";

const apparatusFields = {
  potions: z.enum(APPARATUS_GRADES).optional(),
  poisons: z.enum(APPARATUS_GRADES).optional(),
  transmutation: z.enum(APPARATUS_GRADES).optional(),
} satisfies Record<AlchemyDirection, z.ZodType>;

const alchemyWorkshopSchema = z
  .object({
    alchemyApparatus: z.object(apparatusFields),
    studiedDirections: z.array(z.enum(ALCHEMY_DIRECTIONS)),
  })
  .transform((workshop) => ({
    ...workshop,
    studiedDirections: [...new Set(workshop.studiedDirections)],
  }));

type AlchemyWorkshop = DeepReadonly<z.infer<typeof alchemyWorkshopSchema>>;

export function alchemyWorkshopOf(value: unknown): AlchemyWorkshop {
  return parsedOrRefused(alchemyWorkshopSchema, value, "мастерскую алхимика");
}

export const CRAFTING_FIELDS = {
  alchemyApparatus: z.object(apparatusFields).default({}),
  studiedDirections: z.array(z.enum(ALCHEMY_DIRECTIONS)).default([]),
  ...PROPERTY_RARITY_FIELDS,
  ...KNOWN_RECIPE_FIELDS,
};
