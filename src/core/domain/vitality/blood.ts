import { DomainError } from "@/core/domain/shared/errors";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import { withPlural } from "@/shared/language";

const WOUNDS_PER_PRICE_UNIT = 3;

function assertLevel(level: number): void {
  if (
    !Number.isInteger(level) ||
    level < MINIMUM_CHARACTER_LEVEL ||
    level > MAXIMUM_CHARACTER_LEVEL
  ) {
    throw new DomainError(`Уровень персонажа вне допустимого диапазона: ${level}`);
  }
}

function woundsFromPrice(levelPrice: number): number {
  if (!Number.isInteger(levelPrice) || levelPrice < 0) {
    throw new DomainError(`Цена уровня должна быть целой неотрицательной, получено: ${levelPrice}`);
  }
  return 1 + Math.floor(levelPrice / WOUNDS_PER_PRICE_UNIT);
}

export function woundsWarningRu(levelPrice: number): string {
  return (
    "Хиты уйдут в ноль: 1 рана за сам факт и ещё по 1 за каждые три единицы цены —" +
    ` итого ${withPlural(woundsFromPrice(levelPrice), ["рана", "раны", "ран"])}`
  );
}

export function regenerationPerTurn(level: number): number {
  assertLevel(level);
  return 1 + Math.floor(level / 3);
}

export function maximumRecoveryPerHour(level: number): number {
  return regenerationPerTurn(level);
}

export const LONG_REST_HOURS = 8;

export function maximumReductionAfterHours(
  reduction: number,
  level: number,
  hours: number,
): number {
  if (!Number.isInteger(reduction) || reduction < 0) {
    throw new DomainError(`Снижение максимума должно быть целым неотрицательным, получено: ${reduction}`);
  }
  if (!Number.isInteger(hours) || hours < 0) {
    throw new DomainError(`Число часов должно быть целым неотрицательным, получено: ${hours}`);
  }
  return Math.max(0, reduction - maximumRecoveryPerHour(level) * hours);
}

export const FIRE_SUPPRESSION_TURN_STARTS = 2;

type SuppressionState = {
  firedUponTurnStarts: number;
  underDirectSunlight: boolean;
};

export function suppressedByFire(state: SuppressionState): boolean {
  return state.firedUponTurnStarts > 0;
}

export function traitsSuppressed(state: SuppressionState): boolean {
  return suppressedByFire(state) || state.underDirectSunlight;
}

export function suppressionReason(state: SuppressionState): string | null {
  if (suppressedByFire(state)) {
    return "Кровавое колдовство подавлено уроном огнём до конца следующего хода";
  }
  if (state.underDirectSunlight) {
    return "Кровавое колдовство не действует под прямым солнечным светом";
  }
  return null;
}
