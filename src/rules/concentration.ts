/**
 * Концентрация: КС проверки при получении урона (FR-083).
 *
 * Формула — docs/rules-engine.md#кс-проверки-концентрации.
 */

import type { ActiveEffect } from "@/data/schemas/character";

import { RulesError } from "./abilities";
import { withPlural } from "./language";

/** Минимальная КС проверки концентрации. */
export const MINIMUM_CONCENTRATION_DC = 10;

/** Раунд равен шести секундам (rules-engine.md#что-прерывает-концентрацию). */
export const ROUNDS_PER_MINUTE = 10;
export const ROUNDS_PER_HOUR = 600;

const ROUND_FORMS: [string, string, string] = ["раунд", "раунда", "раундов"];

/**
 * Запись журнала в том объёме, который нужен для раунда начала.
 *
 * Структурный тип, а не импорт из стора: правила не зависят от состояния приложения, иначе
 * получится цикл — `session.ts` сам импортирует правила.
 */
export type TurnMark = { at: string; kind: string };

export type StartRound = {
  round: number;
  /** Начало вытеснено из обрезанного журнала: число — нижняя граница, а не точное значение. */
  approximate: boolean;
};

/**
 * Раунд, в котором начался эффект: столько ходов началось к его времени (FR-084).
 *
 * Считается так же, как раунд в экономии хода — по записям о начале хода. Журнал обрезается
 * (OQ-08), поэтому у долгого эффекта начало может быть потеряно: тогда число помечается неточным.
 */
export function startRound(marks: readonly TurnMark[], startedAt: string): StartRound {
  const started = marks.filter((mark) => mark.kind === "turn_started" && mark.at <= startedAt).length;
  const earliest = marks[0];
  return {
    round: Math.max(1, started),
    approximate: earliest === undefined || earliest.at > startedAt,
  };
}

/**
 * Длительность в исходных единицах и в раундах: «10 минут (100 раундов)».
 *
 * Перевод нужен потому, что за столом время считается раундами, а карточка заклинания — минутами.
 * Отсчёта здесь нет и не будет: таймеры вне MVP (F-08).
 */
export function durationWithRoundsRu(duration: ActiveEffect["duration"]): string {
  const value = duration.value ?? 0;
  switch (duration.type) {
    case "rounds":
      return withPlural(value, ROUND_FORMS);
    case "minutes":
      return `${withPlural(value, ["минута", "минуты", "минут"])} (${withPlural(value * ROUNDS_PER_MINUTE, ROUND_FORMS)})`;
    case "hours":
      return `${withPlural(value, ["час", "часа", "часов"])} (${withPlural(value * ROUNDS_PER_HOUR, ROUND_FORMS)})`;
    default:
      return "особая длительность";
  }
}

/**
 * КС проверки концентрации: максимум из 10 и половины полученного урона (округление вниз).
 *
 * Урон 21 даёт КС 10, урон 22 — КС 11.
 */
export function concentrationCheckDc(damage: number): number {
  if (!Number.isInteger(damage) || damage < 0) {
    throw new RulesError(`Полученный урон должен быть целым неотрицательным, получено: ${damage}`);
  }
  return Math.max(MINIMUM_CONCENTRATION_DC, Math.floor(damage / 2));
}

export type ConcentrationCheck = {
  /** Спасбросок Телосложения — единственный вид проверки концентрации. */
  ability: "CON";
  dc: number;
  modifier: number;
  /** «Боевой заклинатель» даёт преимущество на проверку. */
  hasAdvantage: boolean;
};

/**
 * Готовые данные для карточки проверки: что бросить, против чего и с каким модификатором.
 * Приложение не бросает кубик — бросает игрок (OQ-09).
 */
export function describeConcentrationCheck(
  damage: number,
  constitutionSaveModifier: number,
  options: { hasAdvantage?: boolean } = {},
): ConcentrationCheck {
  if (!Number.isInteger(constitutionSaveModifier)) {
    throw new RulesError(
      `Модификатор спасброска должен быть целым, получено: ${constitutionSaveModifier}`,
    );
  }
  return {
    ability: "CON",
    dc: concentrationCheckDc(damage),
    modifier: constitutionSaveModifier,
    hasAdvantage: options.hasAdvantage === true,
  };
}
