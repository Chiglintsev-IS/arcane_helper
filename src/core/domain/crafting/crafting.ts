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
import type { Apparatus } from "./apparatus";
import { batchFrom } from "./batch";
import type { Batch } from "./batch";
import { developmentCheck } from "./development";
import type { CheckNumbers, DevelopmentCheck } from "./development";
import { recipeDifficulty, recipeSignature, tierOf } from "./recipe";
import type { KnownRecipe, PropertyMatch, RecipeDifficulty, RecipeFormula } from "./recipe";
import { researchPlan } from "./research";
import type { ResearchPlan } from "./research";
import { ingredientKnowledgeOf } from "./schema";
import type { IngredientKnowledge, RevealedProperty } from "./schema";

type CraftingState = {
  ingredientKnowledge: readonly IngredientKnowledge[];
  alchemyApparatus: Apparatus;
  studiedDirections: readonly AlchemyDirection[];
  knownRecipes: readonly KnownRecipe[];
};

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

/** Номера, по которым идёт целенаправленное исследование, — в порядке справочника. */
const RESEARCH_NUMBERS = [1, 2, 3, 4];

function nothingLeftRefusal(nameRu: string): string {
  return `Про «${nameRu}» раскрыты все свойства, какие справочник допускает`;
}

function outOfOrderRefusal(next: number): string {
  return `Целенаправленно исследуют следующее по порядку: сейчас это свойство под номером ${next}`;
}

export class Crafting {
  private static readonly KEYS = [
    "ingredientKnowledge",
    "alchemyApparatus",
    "studiedDirections",
    "knownRecipes",
  ] as const satisfies readonly (keyof CraftingState)[];

  private constructor(private readonly state: CraftingState) {}

  static of(state: CraftingState): Crafting {
    return new Crafting(ownedFields(state, Crafting.KEYS));
  }

  private get data(): readonly IngredientKnowledge[] {
    return this.state.ingredientKnowledge;
  }

  private with(ingredientKnowledge: readonly IngredientKnowledge[]): Crafting {
    return new Crafting({ ...this.state, ingredientKnowledge });
  }

  get all(): readonly IngredientKnowledge[] {
    return this.data;
  }

  /** Чем алхимик работает: качество набора по каждому направлению, где он есть. */
  get apparatus(): Apparatus {
    return this.state.alchemyApparatus;
  }

  /**
   * Чем работа прибавляется к броску разработки.
   *
   * Числа приходят доводом с листа: своих у ремесла нет и быть не может — бонус мастерства и
   * модификатор характеристики принадлежат листу, и второй их счёт разошёлся бы с ним молча.
   */
  checkFor(directions: readonly AlchemyDirection[], numbers: CheckNumbers): DevelopmentCheck {
    return developmentCheck(directions, this.state.studiedDirections, numbers);
  }

  /**
   * Записан ли рецепт настолько, что его повторяют без броска.
   *
   * Рецепт с отдельным риском записан, но проверки не отменяет: справочник требует её для каждой
   * его партии. Оснащение здесь не спрашивается — на него ответит сама работа, отказом с причиной.
   */
  knows(formula: RecipeFormula): boolean {
    const signature = recipeSignature(formula);
    return this.state.knownRecipes.some(
      (known) => !known.risky && recipeSignature(known.formula) === signature,
    );
  }

  /** Записывает разработанный рецепт. Записанный второй раз второй записи не заводит. */
  recordRecipe(formula: RecipeFormula, risky: boolean): Crafting {
    const signature = recipeSignature(formula);
    const others = this.state.knownRecipes.filter(
      (known) => recipeSignature(known.formula) !== signature,
    );
    return new Crafting({ ...this.state, knownRecipes: [...others, { formula, risky }] });
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

  /**
   * Какое свойство вида исследуют следующим: наименьший нераскрытый номер.
   *
   * Целенаправленно исследуют по порядку, и через нераскрытое не перепрыгивают. Раскрытое глубже
   * порядка этому не мешает: экспериментальное смешивание открывает и то, что лежит ниже, а
   * пропуск в середине остаётся тем самым следующим номером.
   */
  private nextResearchable(nameRu: string): number {
    const revealed = new Set(this.located(nameRu).properties.map((property) => property.number));
    const next = RESEARCH_NUMBERS.find((number) => !revealed.has(number));
    if (next === undefined) throw new DomainError(nothingLeftRefusal(nameRu));
    return next;
  }

  /**
   * Во что обойдётся раскрытие названного свойства вида.
   *
   * Оснащение берётся записанное, порядок стережёт сам вид: цену свойства, до которого ещё не
   * добрались, называть незачем — за неё не возьмутся.
   */
  researchPlanFor(
    nameRu: string,
    number: number,
    rarity: RevealedProperty["rarity"],
    direction: AlchemyDirection,
  ): ResearchPlan {
    const next = this.nextResearchable(nameRu);
    if (number !== next) throw new DomainError(outOfOrderRefusal(next));
    return researchPlan({ number, rarity, direction, apparatus: this.apparatus });
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
  difficultyOf(formula: RecipeFormula, apparatus: Apparatus): RecipeDifficulty {
    return recipeDifficulty(this.matches(formula.kinds), formula, apparatus);
  }

  /**
   * Что выйдет из заложенной партии: время, расходники и число готовых единиц.
   *
   * Сложность выше предела оснащения — не «сложно», а невозможно, и отказ называет, чем именно
   * набрано лишнее: погашенная кнопка на этот вопрос не отвечает.
   */
  batchOf(formula: RecipeFormula, apparatus: Apparatus, portions: number): Batch {
    return batchFrom(this.difficultyOf(formula, apparatus), apparatus, portions);
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
