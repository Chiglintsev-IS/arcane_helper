/**
 * Алхимическое оснащение: чем работают и какие пределы это ставит.
 *
 * Постоянного бонуса к проверке оснащение не даёт вовсе. Оно задаёт две границы — предельную
 * сложность работы и предельный размер партии, — и работа сложнее предела не проваливается, а
 * невозможна.
 *
 * Направление, по которому профильного набора нет, работается импровизацией: сложность выше, а
 * предел партии вдвое меньше за каждое такое направление.
 */

import type { AlchemyDirection } from "@/core/domain/catalog/alchemy";

/** Надёжный походный комплект — тот, которым работает алхимик этой сборки. */
export const RELIABLE_FIELD_KIT = "Надёжный походный комплект";

/** Качества оснащения в порядке справочника: сперва походные комплекты, затем модули. */
export const APPARATUS_GRADES = [
  "Обычный походный комплект",
  RELIABLE_FIELD_KIT,
  "Профессиональный походный комплект",
  "Мастерский походный комплект",
  "Базовый лабораторный модуль",
  "Оснащённый лабораторный модуль",
  "Профессиональный лабораторный модуль",
  "Мастерский лабораторный модуль",
  "Великий лабораторный модуль",
] as const;

type ApparatusGrade = (typeof APPARATUS_GRADES)[number];

/** Походные комплекты и стационарные лабораторные модули: предел сложности и предел партии. */
const APPARATUS_LIMITS = {
  "Обычный походный комплект": { hardest: 15, batch: 3 },
  [RELIABLE_FIELD_KIT]: { hardest: 20, batch: 6 },
  "Профессиональный походный комплект": { hardest: 25, batch: 10 },
  "Мастерский походный комплект": { hardest: 30, batch: 15 },
  "Базовый лабораторный модуль": { hardest: 20, batch: 10 },
  "Оснащённый лабораторный модуль": { hardest: 25, batch: 20 },
  "Профессиональный лабораторный модуль": { hardest: 30, batch: 40 },
  "Мастерский лабораторный модуль": { hardest: 35, batch: 80 },
  "Великий лабораторный модуль": { hardest: 45, batch: 150 },
} as const satisfies Record<ApparatusGrade, { hardest: number; batch: number }>;

/** Чем алхимик оснащён по каждому направлению; названного набора у направления может и не быть. */
export type Apparatus = {
  readonly [direction in AlchemyDirection]?: ApparatusGrade | undefined;
};

/** Импровизированные сосуды: то, чем работают, когда профильного набора нет ни одного. */
const IMPROVISED_LIMITS = { hardest: 15, batch: 1 };

/** Работа по направлению без профильного набора стоит столько сложности. */
export const IMPROVISED_DIFFICULTY = 5;

const HALVED = 2;

type ApparatusLimits = {
  readonly hardest: number;
  readonly batch: number;
  readonly improvised: number;
};

/**
 * Пределы работы по названным направлениям и число направлений, оставшихся без набора.
 *
 * Связывает самый слабый из наборов: гибрид не бывает возможнее самого узкого своего места. Делить
 * предел партии не на что, когда набора нет ни одного, — тогда работают импровизированными
 * сосудами, и предел у них свой.
 */
export function apparatusLimits(
  directions: readonly AlchemyDirection[],
  apparatus: Apparatus,
): ApparatusLimits {
  const kits = directions
    .map((direction) => apparatus[direction])
    .filter((grade) => grade !== undefined)
    .map((grade) => APPARATUS_LIMITS[grade]);
  const improvised = directions.length - kits.length;
  if (kits.length === 0) return { ...IMPROVISED_LIMITS, improvised };

  return {
    hardest: Math.min(...kits.map((limits) => limits.hardest)),
    batch: Math.floor(Math.min(...kits.map((limits) => limits.batch)) / HALVED ** improvised),
    improvised,
  };
}
