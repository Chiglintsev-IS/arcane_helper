import { z } from "zod";

import { DomainError } from "@/core/domain/shared/errors";
import { nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";

const DEEPEST_PROPERTY_NUMBER = 4;

/** Порция вида — одна штука, пока стол не назвал другую меру: у большинства ингредиентов так. */
const SMALLEST_PORTION_PIECES = 1;

const PROPERTY_NUMBERS: readonly number[] = Array.from(
  { length: DEEPEST_PROPERTY_NUMBER },
  (_unused, index) => index + 1,
);

function occupiedNumberRefusal(number: number): string {
  return `свойство под номером ${number} уже раскрыто`;
}

function repeatedPropertyRefusal(name: string): string {
  return `свойство «${name}» у этого ингредиента уже раскрыто`;
}

function unrevealedNumberRefusal(nameRu: string, number: number): string {
  return `у вида «${nameRu}» под номером ${number} ничего не раскрыто`;
}

function portionSizeRefusal(pieces: number): string {
  return `Штук в порции — целое от одного, получено: ${pieces}`;
}

function observationTakenRefusal(id: string): string {
  return `наблюдение «${id}» у этого вида уже записано`;
}

function observationMissingRefusal(nameRu: string, id: string): string {
  return `у вида «${nameRu}» нет наблюдения «${id}»`;
}

/** Сказанное столом о виде, чего свойства выразить не могут: слова, а не механика. */
const observationFields = z.object({
  id: nonEmpty,
  textRu: nonEmpty,
});

/** Свойство называет стол своими словами: перечня, по которому его сверять, у ремесла нет. */
const revealedPropertyFields = z.object({
  number: z.number().int().min(1).max(DEEPEST_PROPERTY_NUMBER),
  nameRu: nonEmpty,
});

type AlchemyFields = {
  properties: readonly z.infer<typeof revealedPropertyFields>[];
  observations: readonly z.infer<typeof observationFields>[];
  propertiesExhausted: boolean;
  piecesPerPortion: number;
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
    piecesPerPortion: z
      .number()
      .int()
      .min(SMALLEST_PORTION_PIECES)
      .default(SMALLEST_PORTION_PIECES),
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
  piecesPerPortion: SMALLEST_PORTION_PIECES,
};

/** Номера, под которыми у вида ещё ничего не записано: первый из них и есть следующий по порядку. */
export function unrevealedNumbers(alchemy: IngredientAlchemy): readonly number[] {
  const revealed = new Set(alchemy.properties.map((property) => property.number));
  return PROPERTY_NUMBERS.filter((number) => !revealed.has(number));
}

/** Сколько штук сумки составляют одну порцию вида: меру называет стол, и у каждого вида свою. */
export function withPortionSize(
  alchemy: IngredientAlchemy,
  piecesPerPortion: number,
): IngredientAlchemy {
  if (!Number.isInteger(piecesPerPortion) || piecesPerPortion < SMALLEST_PORTION_PIECES) {
    throw new DomainError(portionSizeRefusal(piecesPerPortion));
  }
  return { ...alchemy, piecesPerPortion };
}

export function piecesForPortions(alchemy: IngredientAlchemy, portions: number): number {
  return alchemy.piecesPerPortion * portions;
}

export function portionsFromPieces(alchemy: IngredientAlchemy, pieces: number): number {
  return Math.floor(pieces / alchemy.piecesPerPortion);
}

export function withRevealedProperty(
  alchemy: IngredientAlchemy,
  property: RevealedProperty,
): IngredientAlchemy {
  return { ...alchemy, properties: [...alchemy.properties, property] };
}

export function withoutProperty(
  nameRu: string,
  alchemy: IngredientAlchemy,
  number: number,
): IngredientAlchemy {
  if (!alchemy.properties.some((property) => property.number === number)) {
    throw new DomainError(unrevealedNumberRefusal(nameRu, number));
  }
  return {
    ...alchemy,
    properties: alchemy.properties.filter((property) => property.number !== number),
  };
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
