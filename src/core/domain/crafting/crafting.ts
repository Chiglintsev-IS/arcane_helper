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
import { alchemyWorkshopOf, ingredientKnowledgeOf } from "./schema";
import type { IngredientKnowledge, RevealedProperty } from "./schema";

type CraftingState = {
  ingredientKnowledge: readonly IngredientKnowledge[];
  alchemyApparatus: Apparatus;
  studiedDirections: readonly AlchemyDirection[];
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

function unevenRarityRefusal(name: string, sources: readonly string[]): string {
  return `Свойство «${name}» записано с разной редкостью у видов: ${sources.join(", ")}`;
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

  get apparatus(): Apparatus {
    return this.state.alchemyApparatus;
  }

  studies(direction: AlchemyDirection): boolean {
    return this.state.studiedDirections.includes(direction);
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

  noteIngredient(nameRu: string): Crafting {
    const noted = ingredientKnowledgeOf({ nameRu });
    if (this.find(noted.nameRu) !== undefined) return this;
    return this.with([...this.data, noted]);
  }

  private replacing(nameRu: string, ingredient: IngredientKnowledge): Crafting {
    return this.with(this.data.map((one) => (one.nameRu === nameRu ? ingredient : one)));
  }

  revealProperty(nameRu: string, property: RevealedProperty): Crafting {
    const known = this.located(nameRu);
    return this.replacing(
      nameRu,
      ingredientKnowledgeOf({ ...known, properties: [...known.properties, property] }),
    );
  }

  markPropertiesExhausted(nameRu: string, exhausted: boolean): Crafting {
    const known = this.located(nameRu);
    return this.replacing(
      nameRu,
      ingredientKnowledgeOf({ ...known, propertiesExhausted: exhausted }),
    );
  }

  private nextResearchable(nameRu: string): number {
    const revealed = new Set(this.located(nameRu).properties.map((property) => property.number));
    const next = RESEARCH_NUMBERS.find((number) => !revealed.has(number));
    if (next === undefined) throw new DomainError(nothingLeftRefusal(nameRu));
    return next;
  }

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

  forgetIngredient(nameRu: string): Crafting {
    this.located(nameRu);
    return this.with(this.data.filter((ingredient) => ingredient.nameRu !== nameRu));
  }

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

  difficultyOf(formula: RecipeFormula, apparatus: Apparatus): RecipeDifficulty {
    return recipeDifficulty(this.matches(formula.kinds), formula, apparatus);
  }

  batchOf(formula: RecipeFormula, apparatus: Apparatus, portions: number): Batch {
    return batchFrom(this.difficultyOf(formula, apparatus), apparatus, portions);
  }

  directionsOf(nameRu: string): readonly AlchemyDirection[] {
    const known = this.located(nameRu);
    return [...new Set(known.properties.map((property) => alchemyDirectionOf(property.nameRu)))];
  }

  toState(): CraftingState {
    return this.state;
  }
}
