/**
 * Кровавое колдовство и расовые особенности лунного тролля.
 *
 * Все числа взяты из документа расы игрока. Раса самодельная, поэтому значения ждут подтверждения
 * мастером. Менять их следует здесь и в спеке одновременно.
 */

import { DomainError } from "@/core/domain/shared/errors";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";

/** Раны за обмен, опустивший здоровье до нуля: одна за сам факт и по одной за каждые три очка. */
const WOUNDS_PER_POINTS = 3;

function assertLevel(level: number): void {
  if (
    !Number.isInteger(level) ||
    level < MINIMUM_CHARACTER_LEVEL ||
    level > MAXIMUM_CHARACTER_LEVEL
  ) {
    throw new DomainError(`Уровень персонажа вне допустимого диапазона: ${level}`);
  }
}

/** Состоявшийся обмен: очки выбирает игрок, хиты считаются по курсу до подтверждения. */
export type Exchange = {
  hitPointsSpent: number;
  pointsCreated: number;
};

/** Раны за обмен, опустивший здоровье до нуля. */
export function woundsFromExchange(pointsCreated: number): number {
  if (!Number.isInteger(pointsCreated) || pointsCreated < 0) {
    throw new DomainError(`Число очков должно быть целым неотрицательным, получено: ${pointsCreated}`);
  }
  return 1 + Math.floor(pointsCreated / WOUNDS_PER_POINTS);
}

/** Восстановление хитов регенерацией за один свой ход. Для 7 уровня — 3. */
export function regenerationPerTurn(level: number): number {
  assertLevel(level);
  return 1 + Math.floor(level / 3);
}

/** Восстановление снижённого максимума за один полный час. Для 7 уровня — 3. */
export function maximumRecoveryPerHour(level: number): number {
  return regenerationPerTurn(level);
}

/** Долгий отдых — восемь часов: столько же почасовых возвратов максимума. */
export const LONG_REST_HOURS = 8;

/**
 * Каким останется снижение максимума после нескольких часов без солнца и огня.
 *
 * Часы считаются тем же почасовым правилом, а не отдельным «отдых всё обнуляет»: за восемь часов
 * Торн возвращает 24 очка, и если он отдал больше, остаток переходит на следующий день. Списать
 * его значило бы вернуть персонажу здоровье, которого правило не даёт.
 */
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

type SuppressionState = {
  /** Урон огнём получен: особенности не работают до конца следующего хода. */
  firedUpon: boolean;
  underDirectSunlight: boolean;
};

/** Работают ли расовые особенности прямо сейчас. */
export function traitsSuppressed(state: SuppressionState): boolean {
  return state.firedUpon || state.underDirectSunlight;
}

/** Доступно ли кровавое колдовство: те же условия подавления. */
export function bloodMagicAvailable(suppression: SuppressionState): boolean {
  return !traitsSuppressed(suppression);
}
