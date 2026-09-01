import { z } from "zod";

import { ALCHEMICAL_RARITIES, alchemyDirectionOf } from "@/core/domain/catalog/alchemy";
import type {
  AlchemicalPropertyName,
  AlchemicalRarity,
  AlchemyDirection,
} from "@/core/domain/catalog/alchemy";
import { DomainError } from "@/core/domain/shared/errors";
import { nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import { apparatusLimits, IMPROVISED_DIFFICULTY } from "./apparatus";
import type { Apparatus } from "./apparatus";

type MatchTier = "plain" | "amplified" | "concentrated";

export type PropertyMatch = {
  readonly nameRu: AlchemicalPropertyName;
  readonly rarity: AlchemicalRarity | undefined;
  readonly sources: readonly string[];
  readonly tier: MatchTier;
};

const AMPLIFIED_FROM_SOURCES = 3;
const CONCENTRATED_FROM_SOURCES = 4;

export function tierOf(sources: number): MatchTier {
  if (sources >= CONCENTRATED_FROM_SOURCES) return "concentrated";
  if (sources >= AMPLIFIED_FROM_SOURCES) return "amplified";
  return "plain";
}

const BASE_DIFFICULTY = 10;
export const LOWEST_DIFFICULTY = 5;

const EFFECT_DIFFICULTY = {
  common: { main: 0, additional: 2 },
  uncommon: { main: 2, additional: 3 },
  rare: { main: 5, additional: 5 },
  veryRare: { main: 8, additional: 7 },
  legendary: { main: 12, additional: 10 },
} as const satisfies Record<AlchemicalRarity, { main: number; additional: number }>;

const TIER_DIFFICULTY = {
  plain: 0,
  amplified: 3,
  concentrated: 6,
} as const satisfies Record<MatchTier, number>;

const DURATION_DIFFICULTY = {
  "1 раунд": -2,
  "3 раунда": 0,
  "1 минута": 2,
  "10 минут": 4,
  "1 час": 6,
  "8 часов": 9,
  "24 часа": 12,
  "До конкретного условия, не более суток": 14,
  "Постоянно": 20,
} as const;

const ONSET_DIFFICULTY = {
  "Немедленно": 0,
  "Постепенно, полная сила через 3 раунда": -1,
  "Задержка до 1 минуты": 1,
  "Задержка до 10 минут": 2,
  "Задержка до 1 часа": 3,
  "Активация при заданном событии": 5,
} as const;

const FULL_REPEAT_DIFFICULTY = 3;
const MOST_REPEAT_DIFFICULTY = 12;

const REACH_DIFFICULTY = {
  "Одна цель, предмет или участок": 0,
  "Две отдельные цели": 2,
  "До четырёх отдельных целей": 4,
  "Радиус 1 м": 3,
  "Радиус 2 м": 5,
  "Радиус 4 м": 8,
  "Радиус 8 м": 12,
} as const;

const APPLICATION_DIFFICULTY = {
  "Выпить, накормить или нанести на неподвижную цель": 0,
  "Нанести через рану или оружейное покрытие": 1,
  "Разбить метаемую ампулу о цель": 2,
  "Вдохнуть или распылить": 3,
  "Краткий контакт с неповреждённой кожей": 3,
  "Дистанционная или условная активация": 5,
} as const;

const RESISTANCE_DIFFICULTY = {
  "Положительное воздействие на добровольную цель": 0,
  "Обычный спасбросок полностью отменяет эффект": 0,
  "Спасбросок с преимуществом": -2,
  "Новый спасбросок в конце каждого раунда": -2,
  "Успех уменьшает эффект вдвое": 2,
  "Один спасбросок при попадании, без повторов": 2,
  "Эффект не допускает спасброска": 8,
} as const;

const PURIFICATION_DIFFICULTY = 5;

const SUPPRESSION_DIFFICULTY = {
  common: 2,
  uncommon: 3,
  rare: 4,
  veryRare: 6,
  legendary: 8,
} as const satisfies Record<AlchemicalRarity, number>;

const LIMITATION_DIFFICULTY = {
  "Только конкретный биологический вид или узкая группа материалов": -2,
  "Требуется уже существующее состояние": -1,
  "Требуется редкое внешнее условие": -2,
  "Состав портится через 24 часа": -1,
  "Состав портится через 1 час": -2,
  "Неизбежный лёгкий побочный эффект": -1,
  "Неизбежный серьёзный побочный эффект": -3,
  "Неизбежное опасное последствие": -5,
} as const;

const MOST_LIMITATION_RELIEF = -6;

type PropertyPolarity = "beneficial" | "harmful" | "neutral";

const POLARITY_BY_DIRECTION = {
  potions: "beneficial",
  poisons: "harmful",
  transmutation: "neutral",
} as const satisfies Record<AlchemyDirection, PropertyPolarity>;

const OPPOSITE_POLARITY = { beneficial: "harmful", harmful: "beneficial" } as const;

type KeptPolarity = keyof typeof OPPOSITE_POLARITY;

export type RecipeFormula = {
  readonly kinds: readonly string[];
  readonly mainProperty: string | null;
  readonly duration: keyof typeof DURATION_DIFFICULTY | null;
  readonly onset: keyof typeof ONSET_DIFFICULTY;
  readonly fullRepeats: number;
  readonly reach: keyof typeof REACH_DIFFICULTY;
  readonly application: keyof typeof APPLICATION_DIFFICULTY;
  readonly resistance: keyof typeof RESISTANCE_DIFFICULTY;
  readonly purification: KeptPolarity | null;
  readonly suppressed: readonly string[];
  readonly limitations: readonly (keyof typeof LIMITATION_DIFFICULTY)[];
};

function fromTable<TTable extends object>(table: TTable, what: string) {
  return z.string().refine((value): value is Extract<keyof TTable, string> => value in table, {
    error: (issue) => `справочник не знает: ${what} «${String(issue.input)}»`,
  });
}

const recipeFormulaSchema = z.object({
  kinds: z.array(nonEmpty),
  mainProperty: nonEmpty.nullable(),
  duration: fromTable(DURATION_DIFFICULTY, "длительность").nullable(),
  onset: fromTable(ONSET_DIFFICULTY, "начало действия"),
  fullRepeats: z.number(),
  reach: fromTable(REACH_DIFFICULTY, "цели и область"),
  application: fromTable(APPLICATION_DIFFICULTY, "способ применения"),
  resistance: fromTable(RESISTANCE_DIFFICULTY, "сопротивление"),
  purification: fromTable(OPPOSITE_POLARITY, "очистка").nullable(),
  suppressed: z.array(nonEmpty),
  limitations: z.array(fromTable(LIMITATION_DIFFICULTY, "ограничение")),
});

type PricedChoice = { value: string; modifier: number };

function priced(table: Readonly<Record<string, number>>): PricedChoice[] {
  return Object.entries(table).map(([value, modifier]) => ({ value, modifier }));
}

export const RECIPE_CHOICES = {
  standard: {
    duration: null,
    onset: "Немедленно",
    fullRepeats: 0,
    reach: "Одна цель, предмет или участок",
    application: "Выпить, накормить или нанести на неподвижную цель",
    resistance: "Положительное воздействие на добровольную цель",
    purification: null,
  },
  durations: priced(DURATION_DIFFICULTY),
  onsets: priced(ONSET_DIFFICULTY),
  reaches: priced(REACH_DIFFICULTY),
  applications: priced(APPLICATION_DIFFICULTY),
  resistances: priced(RESISTANCE_DIFFICULTY),
  limitations: priced(LIMITATION_DIFFICULTY),
  purifications: Object.keys(OPPOSITE_POLARITY).map((value) => ({
    value,
    modifier: PURIFICATION_DIFFICULTY,
  })),
};

export function recipeFormulaOf(value: unknown): RecipeFormula {
  return parsedOrRefused(recipeFormulaSchema, value, "замысел состава");
}

const knownRecipeSchema = z.object({
  formula: recipeFormulaSchema,
  risky: z.boolean(),
});

export type KnownRecipe = { readonly formula: RecipeFormula; readonly risky: boolean };

export const KNOWN_RECIPE_FIELDS = {
  knownRecipes: z.array(knownRecipeSchema).default([]),
};

function canonical(formula: RecipeFormula): RecipeFormula {
  return recipeFormulaOf({
    ...formula,
    kinds: [...new Set(formula.kinds)].sort(),
    suppressed: [...new Set(formula.suppressed)].sort(),
    limitations: [...formula.limitations].sort(),
  });
}

export function recipeSignature(formula: RecipeFormula): string {
  return JSON.stringify(canonical(formula));
}

type DifficultyPart = { readonly nameRu: string; readonly modifier: number };

export type RecipeDifficulty = {
  readonly parts: readonly DifficultyPart[];
  readonly total: number;
  readonly directions: readonly AlchemyDirection[];
  readonly mainRu: string;
};

function repeatsRefusal(): string {
  return "Дополнительных полных срабатываний бывает целое неотрицательное число";
}

function missingMainRefusal(name: string): string {
  return `Основным бывает только оставшееся в составе свойство, а «${name}» в нём нет`;
}

function emptyMixtureRefusal(): string {
  return "В составе не осталось ни одного свойства: оценивать нечего";
}

function mainOf(kept: readonly PropertyMatch[], named: string | null): PropertyMatch {
  if (named === null) return rarestOf(kept);
  const found = kept.find((match) => match.nameRu === named);
  if (found === undefined) throw new DomainError(missingMainRefusal(named));
  return found;
}

function unnamedRarityRefusal(name: string): string {
  return `У свойства «${name}» не названа редкость: без неё сложность не считается`;
}

/** Редкость приходит от стола: её называет мастер, и без неё считать нечем. */
function rarityOf(match: PropertyMatch): AlchemicalRarity {
  if (match.rarity === undefined) throw new DomainError(unnamedRarityRefusal(match.nameRu));
  return match.rarity;
}

function rarestOf(kept: readonly PropertyMatch[]): PropertyMatch {
  const rarest = kept.toSorted(
    (one, other) =>
      ALCHEMICAL_RARITIES.indexOf(rarityOf(other)) - ALCHEMICAL_RARITIES.indexOf(rarityOf(one)),
  )[0];
  if (rarest === undefined) throw new DomainError(emptyMixtureRefusal());
  return rarest;
}

function nothingToPurifyRefusal(): string {
  return "Очистка возможна, когда в составе есть и полезные, и вредные свойства";
}

function unmatchedSuppressionRefusal(name: string): string {
  return `Подавить можно только совпавшее свойство, а «${name}» в составе нет`;
}

function doubleRemovalRefusal(name: string): string {
  return `Свойство «${name}» удаляется один раз: очисткой или подавлением`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function polarityOf(match: PropertyMatch): PropertyPolarity {
  return POLARITY_BY_DIRECTION[alchemyDirectionOf(match.nameRu)];
}

type Removal = { readonly kept: readonly PropertyMatch[]; readonly difficulty: number };

function afterPurification(
  matches: readonly PropertyMatch[],
  purification: RecipeFormula["purification"],
): Removal {
  if (purification === null) return { kept: matches, difficulty: 0 };

  const opposite = OPPOSITE_POLARITY[purification];
  const wanted = matches.filter((match) => polarityOf(match) === purification);
  const opposed = matches.filter((match) => polarityOf(match) === opposite);
  if (wanted.length === 0 || opposed.length === 0) {
    throw new DomainError(nothingToPurifyRefusal());
  }
  return {
    kept: matches.filter((match) => polarityOf(match) !== opposite),
    difficulty: PURIFICATION_DIFFICULTY,
  };
}

function afterSuppression(
  kept: readonly PropertyMatch[],
  matches: readonly PropertyMatch[],
  suppressed: readonly string[],
): Removal {
  const removed = [...new Set(suppressed)].map((name) => {
    const target = matches.find((match) => match.nameRu === name);
    if (target === undefined) throw new DomainError(unmatchedSuppressionRefusal(name));
    if (!kept.includes(target)) throw new DomainError(doubleRemovalRefusal(name));
    return target;
  });
  return {
    kept: kept.filter((match) => !removed.includes(match)),
    difficulty: sum(removed.map((match) => SUPPRESSION_DIFFICULTY[rarityOf(match)])),
  };
}

function rarityDifficulty(kept: readonly PropertyMatch[], main: PropertyMatch): number {
  return sum(
    kept.map((match) =>
      match === main
        ? EFFECT_DIFFICULTY[rarityOf(match)].main
        : EFFECT_DIFFICULTY[rarityOf(match)].additional,
    ),
  );
}

export function recipeDifficulty(
  matches: readonly PropertyMatch[],
  formula: RecipeFormula,
  apparatus: Apparatus,
): RecipeDifficulty {
  if (!Number.isInteger(formula.fullRepeats) || formula.fullRepeats < 0) {
    throw new DomainError(repeatsRefusal());
  }

  const purified = afterPurification(matches, formula.purification);
  const cleansed = afterSuppression(purified.kept, matches, formula.suppressed);
  const main = mainOf(cleansed.kept, formula.mainProperty);

  const directions = [
    ...new Set(cleansed.kept.map((match) => alchemyDirectionOf(match.nameRu))),
  ];
  const parts: readonly DifficultyPart[] = [
    { nameRu: "Редкость эффектов", modifier: rarityDifficulty(cleansed.kept, main) },
    {
      nameRu: "Ступень усиления",
      modifier: sum(cleansed.kept.map((match) => TIER_DIFFICULTY[match.tier])),
    },
    {
      nameRu: "Длительность",
      modifier: formula.duration === null ? 0 : DURATION_DIFFICULTY[formula.duration],
    },
    { nameRu: "Начало действия", modifier: ONSET_DIFFICULTY[formula.onset] },
    {
      nameRu: "Периодичность",
      modifier: Math.min(formula.fullRepeats * FULL_REPEAT_DIFFICULTY, MOST_REPEAT_DIFFICULTY),
    },
    { nameRu: "Цели и область", modifier: REACH_DIFFICULTY[formula.reach] },
    { nameRu: "Способ применения", modifier: APPLICATION_DIFFICULTY[formula.application] },
    { nameRu: "Сопротивление", modifier: RESISTANCE_DIFFICULTY[formula.resistance] },
    { nameRu: "Очистка и подавление", modifier: purified.difficulty + cleansed.difficulty },
    {
      nameRu: "Ограничения и последствия",
      modifier: Math.max(
        sum(formula.limitations.map((limitation) => LIMITATION_DIFFICULTY[limitation])),
        MOST_LIMITATION_RELIEF,
      ),
    },
    {
      nameRu: "Оснащение",
      modifier: IMPROVISED_DIFFICULTY * apparatusLimits(directions, apparatus).improvised,
    },
  ];

  return {
    parts,
    total: Math.max(BASE_DIFFICULTY + sum(parts.map((part) => part.modifier)), LOWEST_DIFFICULTY),
    directions,
    mainRu: main.nameRu,
  };
}
