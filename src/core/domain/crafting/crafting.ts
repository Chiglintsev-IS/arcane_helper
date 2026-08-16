/**
 * Ремесло: что игрок узнал про виды ингредиентов — и ничего о том, сколько их у него в сумке.
 *
 * Отдельно от снаряжения намеренно: снаряжение отвечает «сколько этого у меня», ремесло — «что я про
 * это знаю». Знание переживает и опустевший запас, и уничтоженный образец, а свести их может только
 * тот, кому нужны оба ответа сразу.
 */

import { alchemyDirectionOf } from "@/core/domain/catalog/alchemy";
import type { AlchemyDirection } from "@/core/domain/catalog/alchemy";
import { DomainError } from "@/core/domain/shared/errors";
import { ownedFields } from "@/core/domain/shared/ownedFields";
import { ingredientKnowledgeOf } from "./schema";
import type { IngredientKnowledge, RevealedProperty } from "./schema";

type CraftingState = { ingredientKnowledge: readonly IngredientKnowledge[] };

export class Crafting {
  private static readonly KEYS = [
    "ingredientKnowledge",
  ] as const satisfies readonly (keyof CraftingState)[];

  private constructor(private readonly state: CraftingState) {}

  static of(state: CraftingState): Crafting {
    return new Crafting(ownedFields(state, Crafting.KEYS));
  }

  private get data(): readonly IngredientKnowledge[] {
    return this.state.ingredientKnowledge;
  }

  private with(ingredientKnowledge: readonly IngredientKnowledge[]): Crafting {
    return new Crafting({ ingredientKnowledge });
  }

  get all(): readonly IngredientKnowledge[] {
    return this.data;
  }

  /** Вид опознаётся своим названием: двух записей об одном виде не бывает. */
  find(nameRu: string): IngredientKnowledge | undefined {
    return this.data.find((ingredient) => ingredient.nameRu === nameRu);
  }

  private located(nameRu: string): IngredientKnowledge {
    const found = this.find(nameRu);
    if (found === undefined) {
      throw new DomainError(`Ингредиента «${nameRu}» нет среди записанных`);
    }
    return found;
  }

  /**
   * Записывает вид ингредиента. Второе такое же название вторую запись не заводит: игрок вернулся к
   * тому же корню, а не завёл новый.
   */
  noteIngredient(nameRu: string): Crafting {
    const noted = ingredientKnowledgeOf({ nameRu });
    if (this.find(noted.nameRu) !== undefined) return this;
    return this.with([...this.data, noted]);
  }

  /**
   * Раскрывает свойство под его номером.
   *
   * Занятый номер и повторное свойство отвергает объявление знания: инвариант у него один, и вторая
   * проверка здесь разошлась бы с ним при первой же правке предела.
   */
  revealProperty(nameRu: string, property: RevealedProperty): Crafting {
    const known = this.located(nameRu);
    const revealed = ingredientKnowledgeOf({
      ...known,
      properties: [...known.properties, property],
    });
    return this.with(
      this.data.map((ingredient) => (ingredient.nameRu === nameRu ? revealed : ingredient)),
    );
  }

  /** Забывает вид целиком: записанное по ошибке иначе осталось бы навсегда. */
  forgetIngredient(nameRu: string): Crafting {
    this.located(nameRu);
    return this.with(this.data.filter((ingredient) => ingredient.nameRu !== nameRu));
  }

  /**
   * Направления, которых касается раскрытое у вида.
   *
   * Направление читается по названию свойства, а не хранится рядом с ним: записанное вторым местом,
   * оно разошлось бы с перечнем при первой же правке справочника, и молча.
   */
  directionsOf(nameRu: string): readonly AlchemyDirection[] {
    const known = this.located(nameRu);
    return [...new Set(known.properties.map((property) => alchemyDirectionOf(property.nameRu)))];
  }

  toState(): CraftingState {
    return this.state;
  }
}
