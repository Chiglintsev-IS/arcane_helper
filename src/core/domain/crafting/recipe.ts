/**
 * Рецепт: что совпало в составе и во сколько это обходится сложностью.
 *
 * Числа здесь — таблицы «Алхимии Сумрачного Доминиона» и ничего сверх них. Считать сложность в уме
 * за столом дорого: она собирается из восьми групп поправок, и каждая группа своя таблица.
 *
 * Что совпавшее свойство делает, рецепт не знает: справочник печатает у эффекта только название и
 * направление. Приложение считает цену формы, а действие остаётся столу.
 */

import { z } from "zod";

import { alchemyDirectionOf } from "@/core/domain/catalog/alchemy";
import type { AlchemyDirection } from "@/core/domain/catalog/alchemy";
import { DomainError } from "@/core/domain/shared/errors";
import { nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import { apparatusLimits, IMPROVISED_DIFFICULTY } from "./apparatus";
import type { Apparatus } from "./apparatus";
import type { RevealedProperty } from "./schema";

/** Ступень усиления: обычная, усиленная, концентрированная. */
type MatchTier = "plain" | "amplified" | "concentrated";

/**
 * Совпавшее свойство: чем названо, какой редкости, у каких видов раскрыто и какой ступенью
 * проявится. Насколько ступень усиливает сам эффект, здесь не считается — справочник называет это
 * приблизительно и чисел эффекта не печатает.
 */
export type PropertyMatch = {
  readonly nameRu: RevealedProperty["nameRu"];
  readonly rarity: RevealedProperty["rarity"];
  readonly sources: readonly string[];
  readonly tier: MatchTier;
};

/** С какого числа разных источников совпадение поднимается ступенью выше. */
const AMPLIFIED_FROM_SOURCES = 3;
const CONCENTRATED_FROM_SOURCES = 4;

export function tierOf(sources: number): MatchTier {
  if (sources >= CONCENTRATED_FROM_SOURCES) return "concentrated";
  if (sources >= AMPLIFIED_FROM_SOURCES) return "amplified";
  return "plain";
}

/** Всякий рецепт начинается с десяти и после всех поправок не опускается ниже пяти. */
const BASE_DIFFICULTY = 10;
export const LOWEST_DIFFICULTY = 5;

/** Редкость эффекта: основной оплачивается по своей колонке, каждый дополнительный — по своей. */
const EFFECT_DIFFICULTY = {
  common: { main: 0, additional: 2 },
  uncommon: { main: 2, additional: 3 },
  rare: { main: 5, additional: 5 },
  veryRare: { main: 8, additional: 7 },
  legendary: { main: 12, additional: 10 },
} as const satisfies Record<RevealedProperty["rarity"], { main: number; additional: number }>;

/** Цена ступени усиления. */
const TIER_DIFFICULTY = {
  plain: 0,
  amplified: 3,
  concentrated: 6,
} as const satisfies Record<MatchTier, number>;

/** Длительность. Мгновенный эффект этой таблицей не пользуется вовсе. */
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

/**
 * Периодичность. Распределённое между моментами воздействие цены не меняет; полное повторение
 * оплачивается за каждое дополнительное срабатывание и упирается в потолок.
 */
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

/** Очистка: одна цена за всю группу противоположной направленности. */
const PURIFICATION_DIFFICULTY = 5;

/** Подавление поодиночке: платится за каждое свойство по его редкости. */
const SUPPRESSION_DIFFICULTY = {
  common: 2,
  uncommon: 3,
  rare: 4,
  veryRare: 6,
  legendary: 8,
} as const satisfies Record<RevealedProperty["rarity"], number>;

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

/** Сколько бы ограничений ни набрали, вместе они снимают не больше этого. */
const MOST_LIMITATION_RELIEF = -6;

/**
 * Направленность свойства. Справочник делит смесь на полезные и вредные свойства и прямо называет
 * нейтральными свойства трансмутации; отдельного признака у свойства он не печатает, поэтому
 * направленность читается по направлению алхимии.
 */
type PropertyPolarity = "beneficial" | "harmful" | "neutral";

const POLARITY_BY_DIRECTION = {
  potions: "beneficial",
  poisons: "harmful",
  transmutation: "neutral",
} as const satisfies Record<AlchemyDirection, PropertyPolarity>;

/** Очистка оставляет одну группу и снимает противоположную; нейтральное остаётся при любой. */
const OPPOSITE_POLARITY = { beneficial: "harmful", harmful: "beneficial" } as const;

type KeptPolarity = keyof typeof OPPOSITE_POLARITY;

/** Замысел состава: из чего собран и в какой форме проявляется. */
export type RecipeFormula = {
  readonly kinds: readonly string[];
  readonly mainProperty: string;
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

/**
 * Слово из таблицы справочника: принимается то, что в ней есть, и отвергается всякое другое.
 *
 * Сужает пришедшую строку сам владелец таблицы: перечень, повторённый на границе, разошёлся бы с
 * этим при первой же правке справочника — и молча принял бы форму, которой уже нет.
 */
function fromTable<TTable extends object>(table: TTable, what: string) {
  return z.string().refine((value): value is Extract<keyof TTable, string> => value in table, {
    error: (issue) => `справочник не знает: ${what} «${String(issue.input)}»`,
  });
}

const recipeFormulaSchema = z.object({
  kinds: z.array(nonEmpty),
  mainProperty: nonEmpty,
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

/** Замысел, годный к счёту: проверенный объявлением и отвергнутый с причиной. */
export function recipeFormulaOf(value: unknown): RecipeFormula {
  return parsedOrRefused(recipeFormulaSchema, value, "замысел состава");
}

type DifficultyPart = { readonly nameRu: string; readonly modifier: number };

/**
 * Сложность рецепта: итог, то, из чего он набран, и направления, которых работа касается.
 *
 * Направления здесь, а не рядом: они выясняются по оставшемуся в составе, и от них же зависит
 * поправка за оснащение. Гибрид идёт одной проверкой, и бонус ей достаётся наименьший среди этих
 * направлений — числа проверки спрашивают у листа, ремесло называет только направления.
 */
export type RecipeDifficulty = {
  readonly parts: readonly DifficultyPart[];
  readonly total: number;
  readonly directions: readonly AlchemyDirection[];
};

function repeatsRefusal(): string {
  return "Дополнительных полных срабатываний бывает целое неотрицательное число";
}

function missingMainRefusal(name: string): string {
  return `Основным бывает только оставшееся в составе свойство, а «${name}» в нём нет`;
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
    difficulty: sum(removed.map((match) => SUPPRESSION_DIFFICULTY[match.rarity])),
  };
}

function rarityDifficulty(kept: readonly PropertyMatch[], main: PropertyMatch): number {
  return sum(
    kept.map((match) =>
      match === main
        ? EFFECT_DIFFICULTY[match.rarity].main
        : EFFECT_DIFFICULTY[match.rarity].additional,
    ),
  );
}

/**
 * Сложность рецепта из совпавшего и задуманной формы.
 *
 * Удалённое очисткой или подавлением дополнительным эффектом уже не считается: вместо его редкости
 * платится цена удаления. Отсюда и порядок — сначала выясняется, что в составе осталось, и только
 * потом это оценивается.
 */
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
  const main = cleansed.kept.find((match) => match.nameRu === formula.mainProperty);
  if (main === undefined) throw new DomainError(missingMainRefusal(formula.mainProperty));

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
  };
}
