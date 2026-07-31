/**
 * Концентрация: КС проверки при получении урона (FR-083).
 *
 * Формула — docs/rules-engine.md#кс-проверки-концентрации.
 */

import { RulesError } from "./abilities";

/** Минимальная КС проверки концентрации. */
export const MINIMUM_CONCENTRATION_DC = 10;

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
