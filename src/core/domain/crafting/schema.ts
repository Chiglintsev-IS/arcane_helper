import { z } from "zod";

import { parsedOrRefused } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";
import { APPARATUS_GRADES } from "./apparatus";
import { KNOWN_RECIPE_FIELDS } from "./recipe";

const apparatusField = z.enum(APPARATUS_GRADES).optional();

const alchemyWorkshopSchema = z
  .object({ alchemyApparatus: apparatusField })
  .transform((workshop) => ({ alchemyApparatus: workshop.alchemyApparatus }));

type AlchemyWorkshop = DeepReadonly<z.infer<typeof alchemyWorkshopSchema>>;

export function alchemyWorkshopOf(value: unknown): AlchemyWorkshop {
  return parsedOrRefused(alchemyWorkshopSchema, value, "мастерскую алхимика");
}

export const CRAFTING_FIELDS = {
  alchemyApparatus: apparatusField,
  ...KNOWN_RECIPE_FIELDS,
};
