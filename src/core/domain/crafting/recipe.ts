import { z } from "zod";

import { DomainError } from "@/core/domain/shared/errors";
import { nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import { improvisedDifficulty } from "./apparatus";
import type { Apparatus } from "./apparatus";
import { PLAINEST_RARITY, RARITY_STEPS } from "@/core/domain/shared/rarity";
import type { RarityStepRu } from "@/core/domain/shared/rarity";
import { rarityCost } from "./rarity";

type MatchTier = "plain" | "amplified" | "concentrated";

export type PropertyMatch = {
  /** Даёт ли это совпадение справочник: одного источника ему мало, и такое решает стол. */
  readonly assured: boolean;
  readonly nameRu: string;
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

/** Совпадение справочник даёт от двух видов; больше четырёх состав не держит. */
export const FEWEST_KINDS = 2;
export const MOST_KINDS = 4;

const BASE_DIFFICULTY = 10;
export const LOWEST_DIFFICULTY = 5;

/** Попутное свойство стоит по обычной редкости: про его редкость стол не спрашивают. */
const ADDITIONAL_EFFECT_DIFFICULTY = rarityCost(PLAINEST_RARITY).additional;

/**
 * Очистка снимает со смеси целую сторону — противоположную выбранной, — и потому не спрашивает, что
 * именно в ней было. Одно и то же свойство не снимают дважды: при очистке подавление не платится.
 */
const PURIFICATION_DIFFICULTY = 5;

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

/** Гасят названное свойство, и цену гашения задаёт его редкость — её тоже называет стол. */
type SuppressedProperty = {
  readonly nameRu: string;
  readonly rarityRu: RarityStepRu;
};

export type RecipeFormula = {
  readonly kinds: readonly string[];
  readonly mainProperty: string | null;
  readonly mainRarity: RarityStepRu;
  readonly duration: keyof typeof DURATION_DIFFICULTY | null;
  readonly onset: keyof typeof ONSET_DIFFICULTY;
  readonly fullRepeats: number;
  readonly reach: keyof typeof REACH_DIFFICULTY;
  readonly application: keyof typeof APPLICATION_DIFFICULTY;
  readonly resistance: keyof typeof RESISTANCE_DIFFICULTY;
  readonly purified: boolean;
  readonly suppressed: readonly SuppressedProperty[];
  readonly limitations: readonly (keyof typeof LIMITATION_DIFFICULTY)[];
};

function fromTable<TTable extends object>(table: TTable, what: string) {
  return z.string().refine((value): value is Extract<keyof TTable, string> => value in table, {
    error: (issue) => `справочник не знает: ${what} «${String(issue.input)}»`,
  });
}

const rarityField = z.enum(RARITY_STEPS);

const recipeFormulaSchema = z.object({
  kinds: z.array(nonEmpty),
  mainProperty: nonEmpty.nullable(),
  mainRarity: rarityField.default(PLAINEST_RARITY),
  duration: fromTable(DURATION_DIFFICULTY, "длительность").nullable(),
  onset: fromTable(ONSET_DIFFICULTY, "начало действия"),
  fullRepeats: z.number(),
  reach: fromTable(REACH_DIFFICULTY, "цели и область"),
  application: fromTable(APPLICATION_DIFFICULTY, "способ применения"),
  resistance: fromTable(RESISTANCE_DIFFICULTY, "сопротивление"),
  purified: z.boolean().default(false),
  suppressed: z.array(z.object({ nameRu: nonEmpty, rarityRu: rarityField })),
  limitations: z.array(fromTable(LIMITATION_DIFFICULTY, "ограничение")),
});

export type TierStep = {
  readonly sources: number;
  readonly tier: MatchTier;
  readonly modifier: number;
};

/** Ступень усиления перечнем: число видов-источников свойства и чего оно стоит. */
export function tierSteps(fewest: number, most: number): readonly TierStep[] {
  return Array.from({ length: most - fewest + 1 }, (_unused, index) => {
    const sources = fewest + index;
    return { sources, tier: tierOf(sources), modifier: TIER_DIFFICULTY[tierOf(sources)] };
  });
}

export const RECIPE_TARIFFS = {
  base: BASE_DIFFICULTY,
  lowest: LOWEST_DIFFICULTY,
  additionalEffect: ADDITIONAL_EFFECT_DIFFICULTY,
  purification: PURIFICATION_DIFFICULTY,
  mostRepeats: MOST_REPEAT_DIFFICULTY,
  perRepeat: FULL_REPEAT_DIFFICULTY,
  mostLimitationRelief: MOST_LIMITATION_RELIEF,
} as const;

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
    mainRarity: PLAINEST_RARITY,
    purified: false,
  } as const,
  durations: priced(DURATION_DIFFICULTY),
  onsets: priced(ONSET_DIFFICULTY),
  reaches: priced(REACH_DIFFICULTY),
  applications: priced(APPLICATION_DIFFICULTY),
  resistances: priced(RESISTANCE_DIFFICULTY),
  limitations: priced(LIMITATION_DIFFICULTY),
};

export function recipeFormulaOf(value: unknown): RecipeFormula {
  return parsedOrRefused(recipeFormulaSchema, value, "замысел состава");
}

const knownRecipeSchema = z.object({ formula: recipeFormulaSchema });

export type KnownRecipe = { readonly formula: RecipeFormula };

export const KNOWN_RECIPE_FIELDS = {
  knownRecipes: z.array(knownRecipeSchema).default([]),
};

function canonical(formula: RecipeFormula): RecipeFormula {
  return recipeFormulaOf({
    ...formula,
    kinds: [...new Set(formula.kinds)].sort(),
    suppressed: [...new Map(formula.suppressed.map((one) => [one.nameRu, one])).values()].sort(
      (one, other) => one.nameRu.localeCompare(other.nameRu),
    ),
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
  readonly mainRu: string;
  readonly noticesRu: readonly string[];
  /** Чего справочник не даёт, а стол может разрешить: работать с этим можно только с его слова. */
  readonly warningsRu: readonly string[];
};

const NOTHING_REMOVED_TWICE_RU =
  "Очистка снимает свойство сама: подавление сверх неё не считается и не платится";

function repeatsRefusal(): string {
  return "Дополнительных полных срабатываний бывает целое неотрицательное число";
}

function missingMainRefusal(name: string): string {
  return `Основным бывает только оставшееся в составе свойство, а «${name}» в нём нет`;
}

function emptyMixtureRefusal(): string {
  return "В составе не осталось ни одного свойства: оценивать нечего";
}

/** Не назван — основным становится первое оставшееся: цену состава этот выбор не меняет. */
function mainOf(kept: readonly PropertyMatch[], named: string | null): PropertyMatch {
  const found = named === null ? kept[0] : kept.find((match) => match.nameRu === named);
  if (found === undefined) {
    throw new DomainError(named === null ? emptyMixtureRefusal() : missingMainRefusal(named));
  }
  return found;
}

function unassuredRu(nameRu: string, sources: readonly string[]): string {
  return `«${nameRu}» раскрыто только у одного вида (${sources.join(", ")}): справочник даёт совпадение от ${FEWEST_KINDS} видов`;
}

function unmatchedSuppressionRefusal(name: string): string {
  return `Подавить можно только совпавшее свойство, а «${name}» в составе нет`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

type Removal = { readonly kept: readonly PropertyMatch[]; readonly difficulty: number };

/**
 * Снятое очисткой второй раз не платится: справочник прямо запрещает гасить одно и то же свойство
 * и общей очисткой, и поимённым подавлением.
 */
function afterSuppression(matches: readonly PropertyMatch[], formula: RecipeFormula): Removal {
  const named = [...new Map(formula.suppressed.map((one) => [one.nameRu, one])).values()];
  const removed = named.map((one) => {
    const target = matches.find((match) => match.nameRu === one.nameRu);
    if (target === undefined) throw new DomainError(unmatchedSuppressionRefusal(one.nameRu));
    return { target, rarityRu: one.rarityRu };
  });
  return {
    kept: matches.filter((match) => !removed.some((one) => one.target === match)),
    difficulty: formula.purified
      ? 0
      : sum(removed.map((one) => rarityCost(one.rarityRu).suppression)),
  };
}

/** Профильный набор надбавки не даёт: её платит мастерская, работающая чем придётся. */
const WITH_PROFILE_KIT = 0;

/** Цена самого замысла, какой бы ни была мастерская: ею записанный рецепт и называет свою нужду. */
export function formulaDifficulty(
  matches: readonly PropertyMatch[],
  formula: RecipeFormula,
): RecipeDifficulty {
  return difficultyWith(matches, formula, WITH_PROFILE_KIT);
}

export function recipeDifficulty(
  matches: readonly PropertyMatch[],
  formula: RecipeFormula,
  apparatus: Apparatus,
): RecipeDifficulty {
  return difficultyWith(matches, formula, improvisedDifficulty(apparatus));
}

function difficultyWith(
  matches: readonly PropertyMatch[],
  formula: RecipeFormula,
  equipmentSurcharge: number,
): RecipeDifficulty {
  if (!Number.isInteger(formula.fullRepeats) || formula.fullRepeats < 0) {
    throw new DomainError(repeatsRefusal());
  }

  const cleansed = afterSuppression(matches, formula);
  const main = mainOf(cleansed.kept, formula.mainProperty);

  const parts: readonly DifficultyPart[] = [
    { nameRu: "Основа", modifier: BASE_DIFFICULTY },
    { nameRu: "Основной эффект", modifier: rarityCost(formula.mainRarity).main },
    {
      nameRu: "Дополнительные эффекты",
      modifier: (cleansed.kept.length - 1) * ADDITIONAL_EFFECT_DIFFICULTY,
    },
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
    { nameRu: "Очистка", modifier: formula.purified ? PURIFICATION_DIFFICULTY : 0 },
    { nameRu: "Подавление", modifier: cleansed.difficulty },
    {
      nameRu: "Ограничения и последствия",
      modifier: Math.max(
        sum(formula.limitations.map((limitation) => LIMITATION_DIFFICULTY[limitation])),
        MOST_LIMITATION_RELIEF,
      ),
    },
    { nameRu: "Оснащение", modifier: equipmentSurcharge },
  ];

  return {
    parts,
    total: Math.max(sum(parts.map((part) => part.modifier)), LOWEST_DIFFICULTY),
    mainRu: main.nameRu,
    noticesRu:
      formula.purified && formula.suppressed.length > 0 ? [NOTHING_REMOVED_TWICE_RU] : [],
    warningsRu: cleansed.kept
      .filter((match) => !match.assured)
      .map((match) => unassuredRu(match.nameRu, match.sources)),
  };
}
