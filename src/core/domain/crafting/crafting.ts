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
import { recipeDifficulty, tierOf } from "./recipe";
import type { PropertyMatch, RecipeDifficulty, RecipeFormula } from "./recipe";
import { ingredientKnowledgeOf } from "./schema";
import type { IngredientKnowledge, RevealedProperty } from "./schema";

type CraftingState = { ingredientKnowledge: readonly IngredientKnowledge[] };

/** Видов в составе — от двух до четырёх: меньше не даёт совпадения, больше справочник не берёт. */
const FEWEST_KINDS = 2;
const MOST_KINDS = 4;

function tooFewKindsRefusal(): string {
  return "Состав собирается не меньше чем из двух разных видов ингредиентов";
}

function tooManyKindsRefusal(): string {
  return "Состав собирается не больше чем из четырёх разных видов ингредиентов";
}

/** Отказ выбрать за игрока, какая из двух записанных редкостей одного свойства настоящая. */
function unevenRarityRefusal(name: string, sources: readonly string[]): string {
  return `Свойство «${name}» записано с разной редкостью у видов: ${sources.join(", ")}`;
}

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
   * Свойства, совпавшие у выбранных видов, — все до одного.
   *
   * Все, а не то, ради которого состав задуман: пока состав не очищен, потребитель подвергается
   * каждому совпавшему свойству, и умолчать о непрошенном значит соврать о том, что он выпьет.
   *
   * Источником считается вид, а не порция: две порции одного корня остаются одним источником и
   * совпадения с самим собой не дают.
   */
  matches(kinds: readonly string[]): readonly PropertyMatch[] {
    const distinct = [...new Set(kinds)];
    if (distinct.length < FEWEST_KINDS) throw new DomainError(tooFewKindsRefusal());
    if (distinct.length > MOST_KINDS) throw new DomainError(tooManyKindsRefusal());

    const gathered = new Map<
      RevealedProperty["nameRu"],
      { rarity: RevealedProperty["rarity"]; sources: string[] }
    >();
    for (const ingredient of distinct.map((kind) => this.located(kind))) {
      for (const property of ingredient.properties) {
        const found = gathered.get(property.nameRu);
        if (found === undefined) {
          gathered.set(property.nameRu, { rarity: property.rarity, sources: [ingredient.nameRu] });
          continue;
        }
        found.sources.push(ingredient.nameRu);
        if (found.rarity !== property.rarity) {
          throw new DomainError(unevenRarityRefusal(property.nameRu, found.sources));
        }
      }
    }

    return [...gathered]
      .filter(([, found]) => found.sources.length >= FEWEST_KINDS)
      .map(([nameRu, found]) => ({
        nameRu,
        rarity: found.rarity,
        sources: found.sources,
        tier: tierOf(found.sources.length),
      }));
  }

  /**
   * Сложность рецепта: справочник считает её от совпавшего в составе, а не от одного лишь замысла.
   *
   * Здесь, а не в двух местах: совпадения выясняются по записанному знанию, и второй вычислитель
   * сложности разошёлся бы с этим знанием при первой же правке справочника.
   */
  difficultyOf(formula: RecipeFormula): RecipeDifficulty {
    return recipeDifficulty(this.matches(formula.kinds), formula);
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
