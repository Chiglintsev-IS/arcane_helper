import { z } from "zod";

import {
  ALCHEMICAL_RARITIES,
  ALCHEMY_DIRECTIONS,
  isAlchemicalPropertyName,
} from "@/core/domain/catalog/alchemy";
import type { AlchemyDirection } from "@/core/domain/catalog/alchemy";
import { nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";
import { APPARATUS_GRADES } from "./apparatus";
import { KNOWN_RECIPE_FIELDS } from "./recipe";

const DEEPEST_PROPERTY_NUMBER = 4;

export const PROPERTY_NUMBERS: readonly number[] = Array.from(
  { length: DEEPEST_PROPERTY_NUMBER },
  (_unused, index) => index + 1,
);

function unknownPropertyRefusal(name: string): string {
  return `свойства «${name}» нет в справочнике`;
}

function occupiedNumberRefusal(number: number): string {
  return `свойство под номером ${number} уже раскрыто`;
}

function repeatedPropertyRefusal(name: string): string {
  return `свойство «${name}» у этого ингредиента уже раскрыто`;
}

const revealedPropertyFields = z.object({
  number: z.number().int().min(1).max(DEEPEST_PROPERTY_NUMBER),
  nameRu: z.string().refine(isAlchemicalPropertyName, {
    error: (issue) => unknownPropertyRefusal(String(issue.input)),
  }),
  rarity: z.enum(ALCHEMICAL_RARITIES),
});

type IngredientFields = {
  nameRu: string;
  properties: readonly z.infer<typeof revealedPropertyFields>[];
  propertiesExhausted: boolean;
};

function inNumberOrder(ingredient: IngredientFields): IngredientFields {
  return {
    ...ingredient,
    properties: [...ingredient.properties].sort((one, other) => one.number - other.number),
  };
}

const ingredientKnowledgeSchema = z
  .object({
    nameRu: nonEmpty,
    properties: z.array(revealedPropertyFields).default([]),
    propertiesExhausted: z.boolean().default(false),
  })
  .transform(inNumberOrder)
  .superRefine((ingredient, context) => {
    const numbers = new Set<number>();
    const names = new Set<string>();
    for (const property of ingredient.properties) {
      if (numbers.has(property.number)) {
        context.addIssue({
          code: "custom",
          path: ["properties"],
          message: occupiedNumberRefusal(property.number),
        });
      }
      if (names.has(property.nameRu)) {
        context.addIssue({
          code: "custom",
          path: ["properties"],
          message: repeatedPropertyRefusal(property.nameRu),
        });
      }
      numbers.add(property.number);
      names.add(property.nameRu);
    }
  });

export type RevealedProperty = DeepReadonly<z.infer<typeof revealedPropertyFields>>;
export type IngredientKnowledge = DeepReadonly<z.infer<typeof ingredientKnowledgeSchema>>;

export function ingredientKnowledgeOf(value: unknown): IngredientKnowledge {
  return parsedOrRefused(ingredientKnowledgeSchema, value, "знание об ингредиенте");
}

export function revealedPropertyOf(value: unknown): RevealedProperty {
  return parsedOrRefused(revealedPropertyFields, value, "раскрытое свойство");
}

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
  ingredientKnowledge: z.array(ingredientKnowledgeSchema).default([]),
  alchemyApparatus: z.object(apparatusFields).default({}),
  studiedDirections: z.array(z.enum(ALCHEMY_DIRECTIONS)).default([]),
  ...KNOWN_RECIPE_FIELDS,
};
