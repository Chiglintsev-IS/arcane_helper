/**
 * Подсхема ремесла: что игрок узнал про виды ингредиентов.
 *
 * Знание — не запас. Сколько порций лежит в сумке, знает снаряжение, и запись о виде живёт отдельно
 * именно поэтому: уничтоженный образец не отменяет того, что о нём успели узнать.
 */

import { z } from "zod";

import { ALCHEMICAL_RARITIES, isAlchemicalPropertyName } from "@/core/domain/catalog/alchemy";
import type { AlchemyDirection } from "@/core/domain/catalog/alchemy";
import { nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";
import { APPARATUS_GRADES } from "./apparatus";

/**
 * Глубже четвёртого свойства у ингредиента не бывает — предел справочника.
 *
 * Отсюда же следует, что свойств у ингредиента не больше четырёх: номера не повторяются, а больше
 * четырёх различных номеров в этих границах не набрать. Второго счёта на то же самое нет.
 */
const DEEPEST_PROPERTY_NUMBER = 4;

/** Отказ назвать свойство словом вне перечня: совпадение считается тождеством названий. */
function unknownPropertyRefusal(name: string): string {
  return `свойства «${name}» нет в справочнике`;
}

/** Отказ занять номер, под которым свойство уже стоит. */
function occupiedNumberRefusal(number: number): string {
  return `свойство под номером ${number} уже раскрыто`;
}

/** Отказ раскрыть у ингредиента то, что у него уже раскрыто под другим номером. */
function repeatedPropertyRefusal(name: string): string {
  return `свойство «${name}» у этого ингредиента уже раскрыто`;
}

/**
 * Раскрытое свойство: под каким номером стоит, как называется и какой оно редкости.
 *
 * Редкость приходит от игрока, а не выводится: справочник её не печатает, а без неё не считается ни
 * сложность рецепта, ни сложность исследования.
 */
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
};

/** Хранится по возрастанию номера: порядок записи не должен решать, как знание читается. */
function inNumberOrder(ingredient: IngredientFields): IngredientFields {
  return {
    ...ingredient,
    properties: [...ingredient.properties].sort((one, other) => one.number - other.number),
  };
}

/**
 * Знание о виде ингредиента: название вида и раскрытые у него свойства.
 *
 * Вид опознаётся названием — двух записей об одном виде не бывает. Нераскрытое свойство ничем не
 * хранится: «под этим номером ещё ничего не узнано» и есть отсутствие записи, а пустая ячейка была
 * бы вторым способом сказать то же самое.
 */
const ingredientKnowledgeSchema = z
  .object({
    nameRu: nonEmpty,
    properties: z.array(revealedPropertyFields).default([]),
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

/**
 * Знание, годное к хранению: проверенное объявлением и отвергнутое с причиной.
 *
 * Наружу отдаётся сужение, а не схема: пусти схему за границу, и её начнут расширять на месте, а
 * объявление знания перестанет быть одним.
 */
export function ingredientKnowledgeOf(value: unknown): IngredientKnowledge {
  return parsedOrRefused(ingredientKnowledgeSchema, value, "знание об ингредиенте");
}

/**
 * Чем алхимик оснащён по каждому направлению.
 *
 * Отсутствие записи и есть «набора нет»: пустой отметки о ненайденном не заводится, и работа по
 * такому направлению идёт импровизацией — так её и считает предел оснащения.
 */
const apparatusFields = {
  potions: z.enum(APPARATUS_GRADES).optional(),
  poisons: z.enum(APPARATUS_GRADES).optional(),
  transmutation: z.enum(APPARATUS_GRADES).optional(),
} satisfies Record<AlchemyDirection, z.ZodType>;

/** Поля контекста для сборки полной схемы состояния. */
export const CRAFTING_FIELDS = {
  ingredientKnowledge: z.array(ingredientKnowledgeSchema).default([]),
  alchemyApparatus: z.object(apparatusFields).default({}),
};
