import { z } from "zod";

import { isAlchemicalPropertyName } from "@/core/domain/catalog/alchemy";
import { DomainError } from "@/core/domain/shared/errors";
import { nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";

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

function observationTakenRefusal(id: string): string {
  return `наблюдение «${id}» у этого вида уже записано`;
}

function observationMissingRefusal(nameRu: string, id: string): string {
  return `у вида «${nameRu}» нет наблюдения «${id}»`;
}

/** Сказанное столом о виде, чего перечень свойств выразить не может: слова, а не механика. */
const observationFields = z.object({
  id: nonEmpty,
  textRu: nonEmpty,
});

const revealedPropertyFields = z.object({
  number: z.number().int().min(1).max(DEEPEST_PROPERTY_NUMBER),
  nameRu: z.string().refine(isAlchemicalPropertyName, {
    error: (issue) => unknownPropertyRefusal(String(issue.input)),
  }),
});

type AlchemyFields = {
  properties: readonly z.infer<typeof revealedPropertyFields>[];
  observations: readonly z.infer<typeof observationFields>[];
  propertiesExhausted: boolean;
};

function inNumberOrder(alchemy: AlchemyFields): AlchemyFields {
  return {
    ...alchemy,
    properties: [...alchemy.properties].sort((one, other) => one.number - other.number),
  };
}

export const ingredientAlchemySchema = z
  .object({
    properties: z.array(revealedPropertyFields).default([]),
    observations: z.array(observationFields).default([]),
    propertiesExhausted: z.boolean().default(false),
  })
  .transform(inNumberOrder)
  .superRefine((alchemy, context) => {
    const numbers = new Set<number>();
    const names = new Set<string>();
    for (const property of alchemy.properties) {
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

export type Observation = DeepReadonly<z.infer<typeof observationFields>>;
export type RevealedProperty = DeepReadonly<z.infer<typeof revealedPropertyFields>>;
export type IngredientAlchemy = DeepReadonly<z.infer<typeof ingredientAlchemySchema>>;

export function revealedPropertyOf(value: unknown): RevealedProperty {
  return parsedOrRefused(revealedPropertyFields, value, "раскрытое свойство");
}

export const NO_ALCHEMY: IngredientAlchemy = {
  properties: [],
  observations: [],
  propertiesExhausted: false,
};

export function withRevealedProperty(
  alchemy: IngredientAlchemy,
  property: RevealedProperty,
): IngredientAlchemy {
  return { ...alchemy, properties: [...alchemy.properties, property] };
}

export function withObservation(
  alchemy: IngredientAlchemy,
  observation: Observation,
): IngredientAlchemy {
  if (alchemy.observations.some((seen) => seen.id === observation.id)) {
    throw new DomainError(observationTakenRefusal(observation.id));
  }
  return { ...alchemy, observations: [...alchemy.observations, observation] };
}

function locatedObservation(nameRu: string, alchemy: IngredientAlchemy, id: string): void {
  if (!alchemy.observations.some((seen) => seen.id === id)) {
    throw new DomainError(observationMissingRefusal(nameRu, id));
  }
}

export function withRewrittenObservation(
  nameRu: string,
  alchemy: IngredientAlchemy,
  id: string,
  textRu: string,
): IngredientAlchemy {
  locatedObservation(nameRu, alchemy, id);
  return {
    ...alchemy,
    observations: alchemy.observations.map((seen) =>
      seen.id === id ? { ...seen, textRu } : seen,
    ),
  };
}

export function withoutObservation(
  nameRu: string,
  alchemy: IngredientAlchemy,
  id: string,
): IngredientAlchemy {
  locatedObservation(nameRu, alchemy, id);
  return { ...alchemy, observations: alchemy.observations.filter((seen) => seen.id !== id) };
}
