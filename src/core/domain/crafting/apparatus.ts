import type { AlchemyDirection } from "@/core/domain/catalog/alchemy";

export const RELIABLE_FIELD_KIT = "Надёжный походный комплект";

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

const APPARATUS_LIMITS = {
  "Обычный походный комплект": { hardest: 15, batch: 3, stationary: false },
  [RELIABLE_FIELD_KIT]: { hardest: 20, batch: 6, stationary: false },
  "Профессиональный походный комплект": { hardest: 25, batch: 10, stationary: false },
  "Мастерский походный комплект": { hardest: 30, batch: 15, stationary: false },
  "Базовый лабораторный модуль": { hardest: 20, batch: 10, stationary: true },
  "Оснащённый лабораторный модуль": { hardest: 25, batch: 20, stationary: true },
  "Профессиональный лабораторный модуль": { hardest: 30, batch: 40, stationary: true },
  "Мастерский лабораторный модуль": { hardest: 35, batch: 80, stationary: true },
  "Великий лабораторный модуль": { hardest: 45, batch: 150, stationary: true },
} as const satisfies Record<
  ApparatusGrade,
  { hardest: number; batch: number; stationary: boolean }
>;

export function apparatusOf(
  direction: AlchemyDirection,
  apparatus: Apparatus,
): { readonly hardest: number; readonly batch: number; readonly stationary: boolean } | undefined {
  const grade = apparatus[direction];
  return grade === undefined ? undefined : APPARATUS_LIMITS[grade];
}

export type Apparatus = {
  readonly [direction in AlchemyDirection]?: ApparatusGrade | undefined;
};

const IMPROVISED_LIMITS = { hardest: 15, batch: 1 };

export const IMPROVISED_DIFFICULTY = 5;

const HALVED = 2;

type ApparatusLimits = {
  readonly hardest: number;
  readonly batch: number;
  readonly improvised: number;
};

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
