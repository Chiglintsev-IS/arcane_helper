import { alchemyDirectionOf } from "@/core/domain/catalog/alchemy";
import type {
  AlchemicalPropertyName,
  AlchemicalRarity,
  AlchemyDirection,
} from "@/core/domain/catalog/alchemy";
import { DomainError } from "@/core/domain/shared/errors";
import { ownedFields } from "@/core/domain/shared/ownedFields";
import type { Apparatus } from "./apparatus";
import { batchFrom } from "./batch";
import type { Batch } from "./batch";
import { developmentCheck } from "./development";
import type { CheckNumbers, DevelopmentCheck } from "./development";
import { namedRarityOf, rarityAmong, withRarityNamed } from "./rarities";
import type { NamedRarity } from "./rarities";
import { recipeDifficulty, recipeSignature, tierOf } from "./recipe";
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
    readonly nameRu: AlchemicalPropertyName;
  }[];
};

type CraftingState = {
  alchemyApparatus: Apparatus;
  studiedDirections: readonly AlchemyDirection[];
  propertyRarities: readonly NamedRarity[];
  knownRecipes: readonly KnownRecipe[];
};

const FEWEST_KINDS = 2;
const MOST_KINDS = 4;

function tooFewKindsRefusal(): string {
  return "Состав собирается не меньше чем из двух разных видов ингредиентов";
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
    "studiedDirections",
    "propertyRarities",
    "knownRecipes",
  ] as const satisfies readonly (keyof CraftingState)[];

  private constructor(private readonly state: CraftingState) {}

  static of(state: CraftingState): Crafting {
    return new Crafting(ownedFields(state, Crafting.KEYS));
  }

  get apparatus(): Apparatus {
    return this.state.alchemyApparatus;
  }

  studies(direction: AlchemyDirection): boolean {
    return this.state.studiedDirections.includes(direction);
  }

  rarityOf(nameRu: AlchemicalPropertyName): AlchemicalRarity | undefined {
    return rarityAmong(this.state.propertyRarities, nameRu);
  }

  nameRarity(nameRu: string, rarity: string): Crafting {
    const named = namedRarityOf({ nameRu, rarity });
    return new Crafting({
      ...this.state,
      propertyRarities: withRarityNamed(this.state.propertyRarities, named.nameRu, named.rarity),
    });
  }

  withWorkshop(workshop: unknown): Crafting {
    return new Crafting({ ...this.state, ...alchemyWorkshopOf(workshop) });
  }

  checkFor(directions: readonly AlchemyDirection[], numbers: CheckNumbers): DevelopmentCheck {
    return developmentCheck(directions, this.state.studiedDirections, numbers);
  }

  knows(formula: RecipeFormula): boolean {
    const signature = recipeSignature(formula);
    return this.state.knownRecipes.some(
      (known) => !known.risky && recipeSignature(known.formula) === signature,
    );
  }

  recordRecipe(formula: RecipeFormula, risky: boolean): Crafting {
    const signature = recipeSignature(formula);
    const others = this.state.knownRecipes.filter(
      (known) => recipeSignature(known.formula) !== signature,
    );
    return new Crafting({ ...this.state, knownRecipes: [...others, { formula, risky }] });
  }

  nextResearchable(kind: MixtureKind): number {
    const revealed = new Set(kind.properties.map((property) => property.number));
    const next = RESEARCH_NUMBERS.find((number) => !revealed.has(number));
    if (next === undefined) throw new DomainError(nothingLeftRefusal(kind.nameRu));
    return next;
  }

  researchPlanFor(
    kind: MixtureKind,
    number: number,
    rarity: AlchemicalRarity,
    direction: AlchemyDirection,
  ): ResearchPlan {
    const next = this.nextResearchable(kind);
    if (number !== next) throw new DomainError(outOfOrderRefusal(next));
    return researchPlan({ number, rarity, direction, apparatus: this.apparatus });
  }

  matches(kinds: readonly MixtureKind[]): readonly PropertyMatch[] {
    const distinct = [...new Map(kinds.map((kind) => [kind.id, kind])).values()];
    if (distinct.length < FEWEST_KINDS) throw new DomainError(tooFewKindsRefusal());
    if (distinct.length > MOST_KINDS) throw new DomainError(tooManyKindsRefusal());

    const gathered = new Map<AlchemicalPropertyName, string[]>();
    for (const kind of distinct) {
      for (const property of kind.properties) {
        const sources = gathered.get(property.nameRu);
        if (sources === undefined) gathered.set(property.nameRu, [kind.nameRu]);
        else sources.push(kind.nameRu);
      }
    }

    return [...gathered]
      .filter(([, sources]) => sources.length >= FEWEST_KINDS)
      .map(([nameRu, sources]) => ({
        nameRu,
        rarity: this.rarityOf(nameRu),
        sources,
        tier: tierOf(sources.length),
      }));
  }

  difficultyOf(
    kinds: readonly MixtureKind[],
    formula: RecipeFormula,
    apparatus: Apparatus,
  ): RecipeDifficulty {
    return recipeDifficulty(this.matches(kinds), formula, apparatus);
  }

  batchOf(
    kinds: readonly MixtureKind[],
    formula: RecipeFormula,
    apparatus: Apparatus,
    portions: number,
  ): Batch {
    return batchFrom(this.difficultyOf(kinds, formula, apparatus), apparatus, portions);
  }

  directionsOf(kind: MixtureKind): readonly AlchemyDirection[] {
    return [...new Set(kind.properties.map((property) => alchemyDirectionOf(property.nameRu)))];
  }

  toState(): CraftingState {
    return this.state;
  }
}
