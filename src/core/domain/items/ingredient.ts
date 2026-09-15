import { z } from "zod";

import { DomainError } from "@/core/domain/shared/errors";
import { RARITY_NAMES } from "@/core/domain/shared/rarity";
import { nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";

const DEEPEST_PROPERTY_NUMBER = 4;

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

/**
 * Чем проверяют поиск и сбор вида: справочник стола называет одни и те же проверки для всех видов,
 * и потому они стоят при самом понятии вида, а не при каждой записи.
 */
export const FIND_CHECK_RU = "Мудрость (Внимательность)";
export const GATHER_CHECK_RU = "Интеллект (Травничество)";

/** Сложность проверки называет стол числом: ниже единицы на кости не выпадает ничего. */
const EASIEST_CHECK = 1;

const difficultyClass = z.number().int().min(EASIEST_CHECK);

/**
 * Направление алхимии, к которому свойство относится: у каждого свой профильный навык и своё
 * профильное оснащение, и потому чужое направление узнают, а раскрыть не могут. Направление
 * принадлежит самому свойству — его называет стол вместе с эффектом либо вместо него.
 */
export const ALCHEMY_DIRECTIONS = ["Зельеварение", "Трансмутация", "Синтез ядов"] as const;

/**
 * Свойство называет стол своими словами: перечня, по которому его сверять, у ремесла нет. Направление
 * и редкость стол называет вместе с ним либо не называет вовсе — и тогда их у записи просто нет.
 */
const revealedPropertyFields = z.object({
  number: z.number().int().min(1).max(DEEPEST_PROPERTY_NUMBER),
  nameRu: nonEmpty,
  dirRu: z.enum(ALCHEMY_DIRECTIONS).optional(),
  rarityRu: z.enum(RARITY_NAMES).optional(),
});

/**
 * Справка о виде — то, что стол сказал про сам вид, а не про его свойства: чем проверяют поиск и
 * сбор, сколько порций даёт один сбор и что такое порция на вид и на вес. Ремесло её не считает —
 * порцию оно меряет штуками сумки, — и потому каждое поле стоит ровно там, где его записали.
 */
const referenceFields = z.object({
  findDc: difficultyClass.optional(),
  gatherDc: difficultyClass.optional(),
  yieldRu: nonEmpty.optional(),
  portionRu: nonEmpty.optional(),
});

export type IngredientReference = DeepReadonly<z.infer<typeof referenceFields>>;

/** Смешать вид с самим собой стол разрешает не меньше чем двумя порциями: одна ни с чем не реагирует. */
const FEWEST_SOLO_PORTIONS = 1;

/**
 * Одиночная реакция, утверждённая столом: названное свойство вид даёт без второго вида. Правило
 * штучное — стол утверждает его отдельно каждому виду, вывести его не из чего, — и потому стоит
 * при самом виде. Порций больше одной означает, что вид смешивают сам с собой.
 */
const soloReactionFields = z.object({
  propertyRu: nonEmpty,
  portions: z.number().int().min(FEWEST_SOLO_PORTIONS),
});


type AlchemyFields = {
  properties: readonly z.infer<typeof revealedPropertyFields>[];
  solo?: z.infer<typeof soloReactionFields> | undefined;
} & z.infer<typeof referenceFields>;

function inNumberOrder(alchemy: AlchemyFields): AlchemyFields {
  return {
    ...alchemy,
    properties: [...alchemy.properties].sort((one, other) => one.number - other.number),
  };
}

export const ingredientAlchemySchema = z
  .object({
    properties: z.array(revealedPropertyFields).default([]),
    solo: soloReactionFields.optional(),
    ...referenceFields.shape,
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

export type RevealedProperty = DeepReadonly<z.infer<typeof revealedPropertyFields>>;
export type IngredientAlchemy = DeepReadonly<z.infer<typeof ingredientAlchemySchema>>;

export function revealedPropertyOf(value: unknown): RevealedProperty {
  return parsedOrRefused(revealedPropertyFields, value, "раскрытое свойство");
}

export const NO_ALCHEMY: IngredientAlchemy = { properties: [] };

/** Номера, под которыми у вида ещё ничего не записано: первый из них и есть следующий по порядку. */
export function unrevealedNumbers(alchemy: IngredientAlchemy): readonly number[] {
  const revealed = new Set(alchemy.properties.map((property) => property.number));
  return PROPERTY_NUMBERS.filter((number) => !revealed.has(number));
}

/** Дописанное перекрывает записанное прежде: справку ведут по одному полю, как её и называют. */
export function withReference(
  alchemy: IngredientAlchemy,
  reference: IngredientReference,
): IngredientAlchemy {
  return { ...alchemy, ...parsedOrRefused(referenceFields, reference, "справку о виде") };
}

export function withRevealedProperty(
  alchemy: IngredientAlchemy,
  property: RevealedProperty,
): IngredientAlchemy {
  return { ...alchemy, properties: [...alchemy.properties, property] };
}

/**
 * Переписать раскрытое: слова стола уточняются позже — имя названо иначе, редкость всплыла после.
 * Свойство остаётся под своим номером, а его нераскрытые соседи заведения не получают.
 */
export function withRewrittenProperty(
  nameRu: string,
  alchemy: IngredientAlchemy,
  property: RevealedProperty,
): IngredientAlchemy {
  if (!alchemy.properties.some((one) => one.number === property.number)) {
    throw new DomainError(unrevealedNumberRefusal(nameRu, property.number));
  }
  return {
    ...alchemy,
    properties: alchemy.properties.map((one) =>
      one.number === property.number ? property : one,
    ),
  };
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
