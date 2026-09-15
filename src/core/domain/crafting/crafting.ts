import { DomainError } from "@/core/domain/shared/errors";
import { ownedFields } from "@/core/domain/shared/ownedFields";
import type { Apparatus } from "./apparatus";
import { batchFrom } from "./batch";
import type { Batch } from "./batch";
import { developmentCheck } from "./development";
import type { CheckNumbers, DevelopmentCheck } from "./development";
import {
  FEWEST_KINDS,
  MOST_KINDS,
  formulaDifficulty,
  recipeDifficulty,
  recipeSignature,
  tierOf,
} from "./recipe";
import type { KnownRecipe, PropertyMatch, RecipeDifficulty, RecipeFormula } from "./recipe";
import { researchPlan } from "./research";
import type { ResearchPlan } from "./research";
import { alchemyWorkshopOf } from "./schema";

/**
 * Вид в составе: ремесло получает его параметром и не хранит. Свойства принадлежат самой вещи, а
 * ремесло только считает по ним цену замысла.
 */
export type MixtureKind = {
  readonly id: string;
  readonly nameRu: string;
  readonly properties: readonly {
    readonly number: number;
    readonly nameRu: string;
  }[];
  /**
   * Одиночная реакция, утверждённая столом: названное свойство вид даёт без второго вида, а порций
   * уходит столько, сколько стол назвал, — больше одной значит, что вид смешивают сам с собой.
   */
  readonly solo?: { readonly propertyRu: string; readonly portions: number } | undefined;
};

type CraftingState = {
  alchemyApparatus?: Apparatus;
  knownRecipes: readonly KnownRecipe[];
};

/** Разные виды состава берутся порция за порцию: свою меру в штуках каждый вид знает сам. */
const PORTION_EACH = 1;
function tooFewKindsRefusal(): string {
  return "Состав собирается из двух разных видов ингредиентов, пока стол не утвердил виду одиночную реакцию";
}

function tooManyKindsRefusal(): string {
  return "Состав собирается не больше чем из четырёх разных видов ингредиентов";
}

const RESEARCH_NUMBERS = [1, 2, 3, 4];

function nothingLeftRefusal(nameRu: string): string {
  return `Про «${nameRu}» раскрыты все свойства, какие справочник допускает`;
}

function outOfOrderRefusal(next: number): string {
  return `Целенаправленно исследуют следующее по порядку: сейчас это свойство под номером ${next}`;
}

export class Crafting {
  private static readonly KEYS = [
    "alchemyApparatus",
    "knownRecipes",
  ] as const satisfies readonly (keyof CraftingState)[];

  private constructor(private readonly state: CraftingState) {}

  static of(state: CraftingState): Crafting {
    return new Crafting(ownedFields(state, Crafting.KEYS));
  }

  get apparatus(): Apparatus {
    return this.state.alchemyApparatus;
  }

  withWorkshop(workshop: unknown): Crafting {
    return new Crafting({ ...this.state, ...alchemyWorkshopOf(workshop) });
  }

  checkFor(numbers: CheckNumbers): DevelopmentCheck {
    return developmentCheck(numbers);
  }

  get recipes(): readonly RecipeFormula[] {
    return this.state.knownRecipes.map((known) => known.formula);
  }

  knows(formula: RecipeFormula): boolean {
    const signature = recipeSignature(formula);
    return this.recipes.some((known) => recipeSignature(known) === signature);
  }

  /** Запись перекрывает свою: та же формула, записанная снова, второй строкой книги не встаёт. */
  recordRecipe(formula: RecipeFormula): Crafting {
    const signature = recipeSignature(formula);
    const others = this.state.knownRecipes.filter(
      (known) => recipeSignature(known.formula) !== signature,
    );
    return new Crafting({ ...this.state, knownRecipes: [...others, { formula }] });
  }

  nextResearchable(kind: MixtureKind): number {
    const revealed = new Set(kind.properties.map((property) => property.number));
    const next = RESEARCH_NUMBERS.find((number) => !revealed.has(number));
    if (next === undefined) throw new DomainError(nothingLeftRefusal(kind.nameRu));
    return next;
  }

  researchPlanFor(kind: MixtureKind, number: number): ResearchPlan {
    const next = this.nextResearchable(kind);
    if (number !== next) throw new DomainError(outOfOrderRefusal(next));
    return researchPlan({ number, apparatus: this.apparatus });
  }

  /**
   * Что состав вообще может дать: у каждого свойства названы его источники. Справочник ручается
   * только за те, что раскрыты не меньше чем у двух видов, — остальные названы тоже, потому что
   * разрешить их вправе стол, и молча вычеркнуть его решение приложению не по чину.
   */
  offeredOf(kinds: readonly MixtureKind[]): readonly PropertyMatch[] {
    const distinct = [...new Map(kinds.map((kind) => [kind.id, kind])).values()];
    if (distinct.length > MOST_KINDS) throw new DomainError(tooManyKindsRefusal());
    if (distinct.length === 0) throw new DomainError(tooFewKindsRefusal());

    const alone = distinct.length === 1 ? distinct[0] : undefined;
    const solo = alone?.solo;

    const gathered = new Map<string, string[]>();
    for (const kind of distinct) {
      for (const property of kind.properties) {
        const sources = gathered.get(property.nameRu);
        if (sources === undefined) gathered.set(property.nameRu, [kind.nameRu]);
        else sources.push(kind.nameRu);
      }
    }

    return [...gathered].map(([nameRu, sources]) => ({
      nameRu,
      sources,
      tier: tierOf(sources.length),
      assured: sources.length >= FEWEST_KINDS || nameRu === solo?.propertyRu,
    }));
  }

  /**
   * Что войдёт в состав: совпавшее по справочнику и, если стол назвал такое основным, свойство
   * одного источника. Остальное одиночное в состав не идёт — иначе цель подверглась бы всему, чего
   * справочник ей не обещал.
   */
  matches(kinds: readonly MixtureKind[], mainRu: string | null = null): readonly PropertyMatch[] {
    const offered = this.offeredOf(kinds);
    const assured = offered.filter((match) => match.assured);
    const named = offered.find((match) => match.nameRu === mainRu && !match.assured);
    if (named !== undefined) return [named, ...assured];
    if (assured.length === 0 && new Set(kinds.map((kind) => kind.id)).size < FEWEST_KINDS) {
      throw new DomainError(tooFewKindsRefusal());
    }
    return assured;
  }

  /**
   * Во сколько порций вида обходится одна порция замысла. Обычно в одну: состав ведут разные виды.
   * Одиночную реакцию вид ведёт сам с собой, и тогда столько, сколько стол назвал.
   */
  /** Забыть записанное: рецепт держится на видах, и без них в книге ему нечего называть. */
  forgetRecipes(): Crafting {
    return new Crafting({ ...this.state, knownRecipes: [] });
  }

  portionsEach(kinds: readonly MixtureKind[]): number {
    const alone = kinds.length === 1 ? kinds[0] : undefined;
    return alone?.solo?.portions ?? PORTION_EACH;
  }

  /**
   * Что вид добавит взятым: его свойство совпадёт, если хотя бы у одного из взятых оно уже
   * раскрыто. Пустому составу совпадать не с чем, и отказом это не считается.
   */
  joinsOf(chosen: readonly MixtureKind[], candidate: MixtureKind): readonly string[] {
    const taken = chosen.filter((kind) => kind.id !== candidate.id);
    return candidate.properties
      .filter((property) =>
        taken.some((kind) => kind.properties.some((one) => one.nameRu === property.nameRu)),
      )
      .map((property) => property.nameRu);
  }

  difficultyOf(
    kinds: readonly MixtureKind[],
    formula: RecipeFormula,
    apparatus: Apparatus,
  ): RecipeDifficulty {
    return recipeDifficulty(this.matches(kinds, formula.mainProperty), formula, apparatus);
  }

  /** Записанный рецепт называет цену своего замысла и не смотрит на то, чем работают сейчас. */
  costOf(kinds: readonly MixtureKind[], formula: RecipeFormula): RecipeDifficulty {
    return formulaDifficulty(this.matches(kinds, formula.mainProperty), formula);
  }

  batchOf(
    kinds: readonly MixtureKind[],
    formula: RecipeFormula,
    apparatus: Apparatus,
    portions: number,
  ): Batch {
    return batchFrom(this.difficultyOf(kinds, formula, apparatus), apparatus, portions);
  }

  toState(): CraftingState {
    return this.state;
  }
}
