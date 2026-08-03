/**
 * Кровавое колдовство и расовые особенности лунного тролля.
 *
 * Все числа взяты из документа расы игрока и перенесены в
 *. Раса самодельная, поэтому значения ждут подтверждения
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

export type Exchange = {
  /** Сколько хитов будет потрачено. */
  hitPointsSpent: number;
  pointsCreated: number;
  /** Остаток хитов, не давший очка: равен нулю, если хиты кратны курсу. */
  remainderIgnored: number;
};

/**
 * Обмен хитов на очки: принимает уже вычисленный курс (хитов за одно очко).
 * Остаток в пределах курса не расходуется и не учитывается.
 */
export function exchangeHitPoints(hitPoints: number, rate: number): Exchange {
  if (!Number.isInteger(hitPoints) || hitPoints < 0) {
    throw new DomainError(`Количество хитов должно быть целым неотрицательным, получено: ${hitPoints}`);
  }
  const pointsCreated = Math.floor(hitPoints / rate);
  return {
    hitPointsSpent: pointsCreated * rate,
    pointsCreated,
    remainderIgnored: hitPoints - pointsCreated * rate,
  };
}

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

export type SuppressionState = {
  /** Урон огнём получен: особенности не работают до конца следующего хода. */
  firedUpon: boolean;
  underDirectSunlight: boolean;
};

/** Работают ли расовые особенности прямо сейчас. */
export function traitsSuppressed(state: SuppressionState): boolean {
  return state.firedUpon || state.underDirectSunlight;
}

export type HitPointState = {
  current: number;
  /** Максимум уже с учётом снижения от кровавого колдовства. */
  maximum: number;
};

/**
 * Действует ли регенерация в начале хода: есть хиты, здоровье ниже половины максимума,
 * нет подавления. Порог считается от снижённого максимума, а не от исходного.
 */
export function regenerationApplies(
  hitPoints: HitPointState,
  suppression: SuppressionState,
): boolean {
  if (traitsSuppressed(suppression)) return false;
  if (hitPoints.current <= 0) return false;
  return hitPoints.current < hitPoints.maximum / 2;
}

/** Доступно ли кровавое колдовство: те же условия подавления. */
export function bloodMagicAvailable(suppression: SuppressionState): boolean {
  return !traitsSuppressed(suppression);
}

/**
 * Снижение максимума хитов после обмена: ровно на потраченные хиты.
 * Лечением и регенерацией не устраняется.
 */
export function applyExchangeToHitPoints(
  hitPoints: HitPointState,
  exchange: Exchange,
): HitPointState {
  return {
    current: hitPoints.current - exchange.hitPointsSpent,
    maximum: hitPoints.maximum - exchange.hitPointsSpent,
  };
}

/** КС почасового спасброска под солнцем. Вне MVP, формула сохранена. */
export function sunSaveDc(savesMadeToday: number): number {
  if (!Number.isInteger(savesMadeToday) || savesMadeToday < 0) {
    throw new DomainError(
      `Число совершённых спасбросков должно быть целым неотрицательным, получено: ${savesMadeToday}`,
    );
  }
  return 10 + 2 * savesMadeToday;
}
